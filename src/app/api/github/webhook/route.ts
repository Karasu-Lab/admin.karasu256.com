import { createHmac, timingSafeEqual } from 'node:crypto';
import { log } from '@karasu-lab/utils/server';
import { applyInstallationWebhook, evaluatePushWebhook } from '@/lib/api-auth';
import { parseGitHubWebhookPayload, type GitHubWorkflowRunWebhookPayload } from '@/lib/github-webhook';
import { createCommitStatus, createIssueComment, findMergedPullRequestByCommit, updateIssueComment } from '@/lib/git-api';
import { getTenantNpmRepository, getTenantNpmRepositoryByFullName } from '@/lib/npm-repository';
import {
  deletePublishProgress,
  listPublishProgress,
  loadPublishCommentTemplates,
  recordPublishProgress,
  renderCommentTemplate,
  resolvePublishedPackage,
  setPublishProgressComment,
} from '@/lib/publish-progress';
import { finishPackageUpdate, startPackageUpdate } from '@/lib/update-events';
import { getMasterWebhookSecret, listTenantWebhookSecrets } from '@/lib/webhook-secret';
import { runPointerUpdate, type PointerUpdateResult } from '@/lib/webhook-automation';

export const runtime = 'nodejs';

const PUBLISH_WORKFLOW_NAME = 'Publish packages';
const PUBLISH_STATUS_CONTEXT = 'Publish';
const BUMP_BRANCH_PATTERN = /^chore\/bump-(.+)-([0-9a-f]{7})$/;

async function handleWorkflowRun(
  payload: GitHubWorkflowRunWebhookPayload,
  routedOrganizationId: string | null,
  deliveryId: string | null
): Promise<Response> {
  const run = payload.workflow_run;
  const repositoryFullName = payload.repository.full_name;
  if (payload.action !== 'completed' || run.name !== PUBLISH_WORKFLOW_NAME || run.status !== 'completed') {
    logWebhookIgnored('workflow_run_filtered', {
      event: 'workflow_run',
      deliveryId,
      repositoryFullName,
      action: payload.action,
      workflowName: run.name,
      status: run.status,
    });
    return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
  }
  const npmRepository = await getTenantNpmRepositoryByFullName(repositoryFullName).catch((caught) => {
    logWebhookFailure('publish_npm_repository_load_failed', {
      event: 'workflow_run',
      deliveryId,
      repositoryFullName,
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return null;
  });
  if (!npmRepository) {
    logWebhookFailure('npm_not_configured', { event: 'workflow_run', deliveryId, repositoryFullName });
    return Response.json({ accepted: false, reason: 'npm_not_configured' }, { status: 202 });
  }
  const organizationId = npmRepository.organizationId;
  if (routedOrganizationId && routedOrganizationId !== organizationId) {
    logWebhookFailure('invalid_signature', {
      event: 'workflow_run',
      deliveryId,
      detail: 'tenant_route_mismatch',
      routedOrganizationId,
      organizationId,
    });
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const pending = await listPublishProgress(organizationId).catch((caught) => {
    logWebhookFailure('publish_progress_load_failed', {
      event: 'workflow_run',
      deliveryId,
      organizationId,
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return [];
  });
  if (pending.length === 0) {
    logWebhookFailure('no_pending_publish', { event: 'workflow_run', deliveryId, organizationId, repositoryFullName });
    return Response.json({ accepted: false, reason: 'no_pending_publish' }, { status: 202 });
  }
  let bumpBranch: string | null = null;
  for (const entry of run.pull_requests ?? []) {
    if (BUMP_BRANCH_PATTERN.test(entry.head.ref)) {
      bumpBranch = entry.head.ref;
      break;
    }
  }
  if (!bumpBranch) {
    const merged = await findMergedPullRequestByCommit({
      organizationId,
      repositoryFullName,
      sha: run.head_sha,
    }).catch((caught) => {
      logWebhookFailure('publish_pull_request_lookup_failed', {
        event: 'workflow_run',
        deliveryId,
        organizationId,
        repositoryFullName,
        message: caught instanceof Error ? caught.message : String(caught),
      });
      return null;
    });
    if (merged && BUMP_BRANCH_PATTERN.test(merged.headRef)) bumpBranch = merged.headRef;
  }
  const branchMatch = bumpBranch ? BUMP_BRANCH_PATTERN.exec(bumpBranch) : null;
  if (!branchMatch) {
    logWebhookFailure('bump_branch_not_identified', {
      event: 'workflow_run',
      deliveryId,
      organizationId,
      repositoryFullName,
      headSha: run.head_sha,
    });
    return Response.json({ accepted: false, reason: 'bump_branch_not_identified' }, { status: 202 });
  }
  const repositoryName = branchMatch[1];
  const shaPrefix = branchMatch[2];
  const target = pending.find(
    (entry) => entry.repositoryFullName.split('/')[1] === repositoryName && entry.sha.startsWith(shaPrefix)
  );
  if (!target) {
    logWebhookFailure('no_pending_publish', {
      event: 'workflow_run',
      deliveryId,
      organizationId,
      repositoryFullName,
      repositoryName,
      shaPrefix,
    });
    return Response.json({ accepted: false, reason: 'no_pending_publish' }, { status: 202 });
  }
  const runUrl = run.html_url;
  try {
    const templates = await loadPublishCommentTemplates(organizationId, repositoryFullName);
    if (!templates) {
      logWebhookFailure('publish_comment_templates_missing', {
        event: 'workflow_run',
        deliveryId,
        organizationId,
        npmRepository: repositoryFullName,
      });
    } else {
      const published = await resolvePublishedPackage(organizationId, target.repositoryFullName, target.sha).catch((caught) => {
        logWebhookFailure('published_package_resolve_failed', {
          event: 'workflow_run',
          deliveryId,
          organizationId,
          repositoryFullName: target.repositoryFullName,
          message: caught instanceof Error ? caught.message : String(caught),
        });
        return null;
      });
      const values = {
        packageName: published?.name ?? target.repositoryFullName,
        version: published?.version ?? target.sha.slice(0, 7),
        commit: target.sha.slice(0, 7),
        workflowRunUrl: runUrl,
      };
      const body =
        run.conclusion === 'success'
          ? renderCommentTemplate(templates.published, values)
          : renderCommentTemplate(templates.publishFailed, values);
      if (target.commentId) {
        await updateIssueComment({
          organizationId,
          repositoryFullName: target.repositoryFullName,
          commentId: target.commentId,
          body,
        });
      } else {
        await createIssueComment({
          organizationId,
          repositoryFullName: target.repositoryFullName,
          issueNumber: target.sourcePullRequestNumber,
          body,
        });
      }
      if (target.headSha) {
        try {
          await createCommitStatus({
            organizationId,
            repositoryFullName: target.repositoryFullName,
            sha: target.headSha,
            state: run.conclusion === 'success' ? 'success' : 'failure',
            context: PUBLISH_STATUS_CONTEXT,
            description:
              run.conclusion === 'success'
                ? `Published ${values.packageName}@${values.version}`
                : `Failed to publish ${values.packageName}`,
            targetUrl: runUrl,
          });
        } catch (statusError) {
          logWebhookFailure('publish_status_update_failed', {
            event: 'workflow_run',
            deliveryId,
            organizationId,
            repositoryFullName: target.repositoryFullName,
            message: statusError instanceof Error ? statusError.message : String(statusError),
          });
        }
      }
    }
  } catch (caught) {
    logWebhookFailure('publish_comment_failed', {
      event: 'workflow_run',
      deliveryId,
      organizationId,
      repositoryFullName: target.repositoryFullName,
      message: caught instanceof Error ? caught.message : String(caught),
    });
  }
  await deletePublishProgress(target.id).catch((caught) => {
    logWebhookFailure('publish_progress_clear_failed', {
      event: 'workflow_run',
      deliveryId,
      organizationId,
      message: caught instanceof Error ? caught.message : String(caught),
    });
  });
  return Response.json({ accepted: true }, { status: 202 });
}

function logWebhookFailure(reason: string, data: Record<string, unknown> = {}): void {
  log('github_webhook_failed', { reason, ...data }, 'error');
}

function logWebhookIgnored(reason: string, data: Record<string, unknown> = {}): void {
  log('github_webhook_ignored', { reason, ...data }, 'info');
}

function signatureValid(secret: string, body: string, header: string | null): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const event = request.headers.get('x-github-event');
  const deliveryId = request.headers.get('x-github-delivery');
  const masterSecret = getMasterWebhookSecret();
  const tenantSecrets = await listTenantWebhookSecrets().catch((caught) => {
    logWebhookFailure('tenant_secrets_load_failed', {
      event,
      deliveryId,
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return [];
  });
  if (!masterSecret && tenantSecrets.length === 0) {
    logWebhookFailure('webhook_not_configured', { event, deliveryId });
    return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  }
  const signature = request.headers.get('x-hub-signature-256');
  const matchedByMaster = masterSecret !== null && signatureValid(masterSecret, body, signature);
  const matchedTenant = tenantSecrets.find(({ secret }) => signatureValid(secret, body, signature)) ?? null;
  if (!matchedByMaster && !matchedTenant) {
    logWebhookFailure('invalid_signature', { event, deliveryId });
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const routedOrganizationId = matchedTenant?.organizationId ?? null;
  if (event !== 'push' && event !== 'installation' && event !== 'workflow_run') {
    return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
  }
  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(body);
  } catch {
    logWebhookFailure('invalid_payload', { event, deliveryId, detail: 'json_parse_failed' });
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const parsedPayload = parseGitHubWebhookPayload(event, payloadJson);
  if (!parsedPayload.success) {
    if (parsedPayload.reason === 'unknown_event') {
      return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
    }
    logWebhookFailure('invalid_payload', {
      event,
      deliveryId,
      issues: parsedPayload.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    });
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  if (parsedPayload.event === 'workflow_run') {
    return handleWorkflowRun(parsedPayload.data, routedOrganizationId, deliveryId);
  }
  if (parsedPayload.event === 'installation') {
    const result = await applyInstallationWebhook({
      installationId: parsedPayload.data.installation.id,
      action: parsedPayload.data.action,
    });
    if (routedOrganizationId && result.organizationId && result.organizationId !== routedOrganizationId) {
      logWebhookFailure('invalid_signature', {
        event,
        deliveryId,
        detail: 'tenant_route_mismatch',
        routedOrganizationId,
        organizationId: result.organizationId,
      });
      return Response.json({ error: 'invalid_signature' }, { status: 401 });
    }
    if (!result.accepted) {
      logWebhookFailure(result.reason ?? 'installation_not_accepted', {
        event,
        deliveryId,
        installationId: parsedPayload.data.installation.id,
        action: parsedPayload.data.action,
      });
    }
    return Response.json(result, { status: 202 });
  }
  const parsed = parsedPayload;
  const defaultBranch = parsed.data.repository.default_branch;
  if (defaultBranch && parsed.data.ref !== `refs/heads/${defaultBranch}`) {
    logWebhookIgnored('not_default_branch', {
      event,
      deliveryId,
      repositoryFullName: parsed.data.repository.full_name,
      ref: parsed.data.ref,
    });
    return Response.json({ accepted: false, reason: 'not_default_branch' }, { status: 202 });
  }
  const decision = await evaluatePushWebhook({
    installationId: parsed.data.installation.id,
    repositoryFullName: parsed.data.repository.full_name,
    afterSha: parsed.data.after,
  });
  if (routedOrganizationId && decision.organizationId && decision.organizationId !== routedOrganizationId) {
    logWebhookFailure('invalid_signature', {
      event,
      deliveryId,
      detail: 'tenant_route_mismatch',
      routedOrganizationId,
      organizationId: decision.organizationId,
    });
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  if (!decision.accepted || !decision.organizationId) {
    logWebhookFailure(decision.reason ?? 'not_accepted', {
      event,
      deliveryId,
      installationId: parsed.data.installation.id,
      repositoryFullName: parsed.data.repository.full_name,
      afterSha: parsed.data.after,
      organizationId: decision.organizationId,
    });
    return Response.json({ accepted: false, reason: decision.reason ?? 'not_accepted' }, { status: 202 });
  }
  let npmRepository;
  try {
    npmRepository = await getTenantNpmRepository(decision.organizationId);
  } catch (error) {
    logWebhookFailure('npm_repository_lookup_failed', {
      event,
      deliveryId,
      organizationId: decision.organizationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { accepted: false, reason: `npm_repository_lookup_failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 202 }
    );
  }
  if (!npmRepository?.npmRepositoryFullName) {
    logWebhookFailure('npm_not_configured', { event, deliveryId, organizationId: decision.organizationId });
    return Response.json({ accepted: false, reason: 'npm_not_configured' }, { status: 202 });
  }
  let updateEventId: string | null = null;
  if (decision.package) {
    try {
      updateEventId = await startPackageUpdate({
        organizationId: decision.organizationId,
        packageId: decision.package.id,
        repositoryFullName: decision.package.repositoryFullName,
        fromSha: decision.package.lastSyncedSha,
        toSha: parsed.data.after,
      });
    } catch (error) {
      logWebhookFailure('update_start_record_failed', {
        event,
        deliveryId,
        organizationId: decision.organizationId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  let result: PointerUpdateResult;
  try {
    result = await runPointerUpdate({ ...decision, accepted: true }, npmRepository, parsed.data.after);
  } catch (error) {
    logWebhookFailure('pointer_update_failed', {
      event,
      deliveryId,
      organizationId: decision.organizationId,
      repositoryFullName: parsed.data.repository.full_name,
      message: error instanceof Error ? error.message : String(error),
    });
    if (updateEventId) {
      await finishPackageUpdate(
        updateEventId,
        decision.organizationId,
        'failed',
        error instanceof Error ? error.message : String(error)
      ).catch((caught) => {
        logWebhookFailure('update_result_record_failed', {
          event,
          deliveryId,
          organizationId: decision.organizationId,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });
    }
    throw error;
  }
  if (updateEventId) {
    const status = result.automated || result.reason === 'already_synced' ? 'completed' : 'failed';
    await finishPackageUpdate(updateEventId, decision.organizationId, status, status === 'failed' ? result.reason : undefined).catch(
      (caught) => {
        logWebhookFailure('update_result_record_failed', {
          event,
          deliveryId,
          organizationId: decision.organizationId,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      }
    );
  }
  if (!result.automated && result.reason !== 'already_synced') {
    logWebhookFailure(result.reason ?? 'pointer_update_not_automated', {
      event,
      deliveryId,
      organizationId: decision.organizationId,
      repositoryFullName: parsed.data.repository.full_name,
      afterSha: parsed.data.after,
    });
  }
  if (result.automated && result.pullRequestUrl && decision.package) {
    const linked = decision.package;
    try {
      const sourcePullRequest = await findMergedPullRequestByCommit({
        organizationId: decision.organizationId,
        repositoryFullName: linked.repositoryFullName,
        sha: parsed.data.after,
      });
      if (sourcePullRequest) {
        const progressId = await recordPublishProgress({
          organizationId: decision.organizationId,
          packageId: linked.id,
          repositoryFullName: linked.repositoryFullName,
          sha: parsed.data.after,
          sourcePullRequestNumber: sourcePullRequest.number,
          bumpPullRequestUrl: result.pullRequestUrl,
          headSha: sourcePullRequest.headSha,
        });
        const templates = npmRepository.npmRepositoryFullName
          ? await loadPublishCommentTemplates(decision.organizationId, npmRepository.npmRepositoryFullName)
          : null;
        if (!templates) {
          logWebhookFailure('publish_comment_templates_missing', {
            event,
            deliveryId,
            organizationId: decision.organizationId,
            npmRepository: npmRepository.npmRepositoryFullName,
          });
        } else {
          const comment = await createIssueComment({
            organizationId: decision.organizationId,
            repositoryFullName: linked.repositoryFullName,
            issueNumber: sourcePullRequest.number,
            body: renderCommentTemplate(templates.pointerUpdate, {
              pullRequestUrl: result.pullRequestUrl,
              npmRepository: npmRepository.npmRepositoryFullName ?? '',
              commit: parsed.data.after.slice(0, 7),
            }),
          });
          await setPublishProgressComment(progressId, comment.id);
          try {
            await createCommitStatus({
              organizationId: decision.organizationId,
              repositoryFullName: linked.repositoryFullName,
              sha: sourcePullRequest.headSha,
              state: 'pending',
              context: PUBLISH_STATUS_CONTEXT,
              description: `Publishing ${linked.repositoryFullName}`,
              targetUrl: result.pullRequestUrl,
            });
          } catch (statusError) {
            logWebhookFailure('publish_status_failed', {
              event,
              deliveryId,
              organizationId: decision.organizationId,
              repositoryFullName: linked.repositoryFullName,
              message: statusError instanceof Error ? statusError.message : String(statusError),
            });
          }
        }
      }
    } catch (caught) {
      logWebhookFailure('pointer_update_comment_failed', {
        event,
        deliveryId,
        organizationId: decision.organizationId,
        repositoryFullName: linked.repositoryFullName,
        message: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }
  return Response.json(result, { status: 202 });
}
