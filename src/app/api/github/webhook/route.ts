import { createHmac, timingSafeEqual } from 'node:crypto';
import { applyInstallationWebhook, evaluatePushWebhook } from '@/lib/api-auth';
import { parseGitHubWebhookPayload, type GitHubWorkflowRunWebhookPayload } from '@/lib/github-webhook';
import { createIssueComment, findMergedPullRequestByCommit } from '@/lib/git-api';
import { getTenantNpmRepository, getTenantNpmRepositoryByFullName } from '@/lib/npm-repository';
import {
  deletePublishProgress,
  listPublishProgress,
  loadPublishCommentTemplates,
  recordPublishProgress,
  renderCommentTemplate,
  resolvePublishedPackage,
} from '@/lib/publish-progress';
import { finishPackageUpdate, startPackageUpdate } from '@/lib/update-events';
import { getMasterWebhookSecret, listTenantWebhookSecrets } from '@/lib/webhook-secret';
import { runPointerUpdate, type PointerUpdateResult } from '@/lib/webhook-automation';

export const runtime = 'nodejs';

const PUBLISH_WORKFLOW_NAME = 'Publish packages';
const BUMP_BRANCH_PATTERN = /^chore\/bump-(.+)-([0-9a-f]{7})$/;

async function handleWorkflowRun(payload: GitHubWorkflowRunWebhookPayload, routedOrganizationId: string | null): Promise<Response> {
  const run = payload.workflow_run;
  const repositoryFullName = payload.repository.full_name;
  if (payload.action !== 'completed' || run.name !== PUBLISH_WORKFLOW_NAME || run.status !== 'completed') {
    return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
  }
  const npmRepository = await getTenantNpmRepositoryByFullName(repositoryFullName).catch((caught) => {
    console.error(caught instanceof Error ? new Error(`failed to resolve the npm repository ${repositoryFullName}: ${caught.message}`) : caught);
    return null;
  });
  if (!npmRepository) return Response.json({ accepted: false, reason: 'npm_not_configured' }, { status: 202 });
  const organizationId = npmRepository.organizationId;
  if (routedOrganizationId && routedOrganizationId !== organizationId) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const pending = await listPublishProgress(organizationId).catch((caught) => {
    console.error(caught instanceof Error ? new Error(`failed to load the pending publish progress: ${caught.message}`) : caught);
    return [];
  });
  if (pending.length === 0) return Response.json({ accepted: false, reason: 'no_pending_publish' }, { status: 202 });
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
      console.error(caught instanceof Error ? new Error(`failed to find the pull request for the publish run commit: ${caught.message}`) : caught);
      return null;
    });
    if (merged && BUMP_BRANCH_PATTERN.test(merged.headRef)) bumpBranch = merged.headRef;
  }
  const branchMatch = bumpBranch ? BUMP_BRANCH_PATTERN.exec(bumpBranch) : null;
  if (!branchMatch) return Response.json({ accepted: false, reason: 'bump_branch_not_identified' }, { status: 202 });
  const repositoryName = branchMatch[1];
  const shaPrefix = branchMatch[2];
  const target = pending.find(
    (entry) => entry.repositoryFullName.split('/')[1] === repositoryName && entry.sha.startsWith(shaPrefix)
  );
  if (!target) return Response.json({ accepted: false, reason: 'no_pending_publish' }, { status: 202 });
  const runUrl = run.html_url;
  try {
    const templates = await loadPublishCommentTemplates(organizationId, repositoryFullName);
    if (!templates) {
      console.error(new Error(`the publish progress comment templates were not found in ${repositoryFullName}`));
    } else {
      const published = await resolvePublishedPackage(organizationId, target.repositoryFullName, target.sha).catch((caught) => {
        console.error(caught instanceof Error ? new Error(`failed to resolve the published package version: ${caught.message}`) : caught);
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
      await createIssueComment({
        organizationId,
        repositoryFullName: target.repositoryFullName,
        issueNumber: target.sourcePullRequestNumber,
        body,
      });
    }
  } catch (caught) {
    console.error(caught instanceof Error ? new Error(`failed to post the publish progress comment: ${caught.message}`) : caught);
  }
  await deletePublishProgress(target.id).catch((caught) => {
    console.error(caught instanceof Error ? new Error(`failed to clear the publish progress record: ${caught.message}`) : caught);
  });
  return Response.json({ accepted: true }, { status: 202 });
}

function signatureValid(secret: string, body: string, header: string | null): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const masterSecret = getMasterWebhookSecret();
  const tenantSecrets = await listTenantWebhookSecrets().catch((caught) => {
    console.error(caught instanceof Error ? new Error(`failed to load the tenant webhook secrets: ${caught.message}`) : caught);
    return [];
  });
  if (!masterSecret && tenantSecrets.length === 0) {
    return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  }
  const signature = request.headers.get('x-hub-signature-256');
  const matchedByMaster = masterSecret !== null && signatureValid(masterSecret, body, signature);
  const matchedTenant = tenantSecrets.find(({ secret }) => signatureValid(secret, body, signature)) ?? null;
  if (!matchedByMaster && !matchedTenant) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const routedOrganizationId = matchedTenant?.organizationId ?? null;
  const event = request.headers.get('x-github-event');
  if (event !== 'push' && event !== 'installation' && event !== 'workflow_run') {
    return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
  }
  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(body);
  } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const parsedPayload = parseGitHubWebhookPayload(event, payloadJson);
  if (!parsedPayload.success) {
    if (parsedPayload.reason === 'unknown_event') {
      return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
    }
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  if (parsedPayload.event === 'workflow_run') {
    return handleWorkflowRun(parsedPayload.data, routedOrganizationId);
  }
  if (parsedPayload.event === 'installation') {
    const result = await applyInstallationWebhook({
      installationId: parsedPayload.data.installation.id,
      action: parsedPayload.data.action,
    });
    if (routedOrganizationId && result.organizationId && result.organizationId !== routedOrganizationId) {
      return Response.json({ error: 'invalid_signature' }, { status: 401 });
    }
    return Response.json(result, { status: 202 });
  }
  const parsed = parsedPayload;
  const defaultBranch = parsed.data.repository.default_branch;
  if (defaultBranch && parsed.data.ref !== `refs/heads/${defaultBranch}`) {
    return Response.json({ accepted: false, reason: 'not_default_branch' }, { status: 202 });
  }
  const decision = await evaluatePushWebhook({
    installationId: parsed.data.installation.id,
    repositoryFullName: parsed.data.repository.full_name,
    afterSha: parsed.data.after,
  });
  if (routedOrganizationId && decision.organizationId && decision.organizationId !== routedOrganizationId) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  if (!decision.accepted || !decision.organizationId) {
    return Response.json({ accepted: false, reason: decision.reason ?? 'not_accepted' }, { status: 202 });
  }
  let npmRepository;
  try {
    npmRepository = await getTenantNpmRepository(decision.organizationId);
  } catch (error) {
    return Response.json(
      { accepted: false, reason: `npm_repository_lookup_failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 202 }
    );
  }
  if (!npmRepository?.npmRepositoryFullName) {
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
      console.error(error instanceof Error ? new Error(`failed to record the package update start: ${error.message}`) : error);
    }
  }
  let result: PointerUpdateResult;
  try {
    result = await runPointerUpdate({ ...decision, accepted: true }, npmRepository, parsed.data.after);
  } catch (error) {
    if (updateEventId) {
      await finishPackageUpdate(
        updateEventId,
        decision.organizationId,
        'failed',
        error instanceof Error ? error.message : String(error)
      ).catch((caught) => {
        console.error(caught instanceof Error ? new Error(`failed to record the package update failure: ${caught.message}`) : caught);
      });
    }
    throw error;
  }
  if (updateEventId) {
    const status = result.automated || result.reason === 'already_synced' ? 'completed' : 'failed';
    await finishPackageUpdate(updateEventId, decision.organizationId, status, status === 'failed' ? result.reason : undefined).catch(
      (caught) => {
        console.error(caught instanceof Error ? new Error(`failed to record the package update result: ${caught.message}`) : caught);
      }
    );
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
        await recordPublishProgress({
          organizationId: decision.organizationId,
          packageId: linked.id,
          repositoryFullName: linked.repositoryFullName,
          sha: parsed.data.after,
          sourcePullRequestNumber: sourcePullRequest.number,
          bumpPullRequestUrl: result.pullRequestUrl,
        });
        const templates = npmRepository.npmRepositoryFullName
          ? await loadPublishCommentTemplates(decision.organizationId, npmRepository.npmRepositoryFullName)
          : null;
        if (!templates) {
          console.error(
            new Error(`the publish progress comment templates were not found in ${npmRepository.npmRepositoryFullName ?? 'the npm repository'}`)
          );
        } else {
          await createIssueComment({
            organizationId: decision.organizationId,
            repositoryFullName: linked.repositoryFullName,
            issueNumber: sourcePullRequest.number,
            body: renderCommentTemplate(templates.pointerUpdate, {
              pullRequestUrl: result.pullRequestUrl,
              npmRepository: npmRepository.npmRepositoryFullName ?? '',
              commit: parsed.data.after.slice(0, 7),
            }),
          });
        }
      }
    } catch (caught) {
      console.error(caught instanceof Error ? new Error(`failed to post the pointer update comment: ${caught.message}`) : caught);
    }
  }
  return Response.json(result, { status: 202 });
}
