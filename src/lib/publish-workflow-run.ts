import 'server-only';
import { z } from 'zod';
import { log } from '@karasu-lab/utils/server';
import {
  commitStatusStateSchema,
  createCommitStatus,
  createIssueComment,
  findMergedPullRequestByCommit,
  updateIssueComment,
} from './git-api';
import type { GitHubWorkflowRunWebhookPayload } from './github-webhook';
import { getTenantNpmRepositoryByRepositoryId } from './npm-repository';
import { PublishComments, PublishProgress, type PackagePublishProgress } from './publish-progress';

export function workflowRunStateSchema() {
  return z.enum(['completed']);
}

export function workflowRunConclusionSchema() {
  return z.enum(['success']);
}

export function publishWorkflowRunResultSchema() {
  return z.object({
    accepted: z.boolean(),
    reason: z.enum(['event_ignored', 'npm_not_configured', 'no_pending_publish', 'bump_branch_not_identified']).optional(),
    unauthorized: z.boolean().optional(),
  });
}

export type PublishWorkflowRunResult = z.infer<ReturnType<typeof publishWorkflowRunResultSchema>>;

export class PublishWorkflowRunHandler {
  publishWorkflowName = 'Publish packages';
  publishStatusContext = 'Publish';
  bumpBranchPattern = /^chore\/bump-(.+)-([0-9a-f]{7})$/;
  shortShaLength = 7;
  states = workflowRunStateSchema().enum;
  conclusions = workflowRunConclusionSchema().enum;
  commitStates = commitStatusStateSchema().enum;
  comments = new PublishComments();
  progress = new PublishProgress();

  private messageOf(caught: unknown): string {
    return caught instanceof Error ? caught.message : String(caught);
  }

  private async identifyBumpBranch(
    payload: GitHubWorkflowRunWebhookPayload,
    organizationId: string
  ): Promise<RegExpExecArray | null> {
    const run = payload.workflow_run;
    const fromPullRequests = (run.pull_requests ?? []).map((entry) => entry.head.ref).find((ref) => this.bumpBranchPattern.test(ref));
    if (fromPullRequests) return this.bumpBranchPattern.exec(fromPullRequests);
    const merged = await findMergedPullRequestByCommit({
      organizationId,
      repositoryFullName: payload.repository.full_name,
      sha: run.head_sha,
    }).catch((caught) => {
      log(
        'publish_pull_request_lookup_failed',
        { organizationId, repositoryFullName: payload.repository.full_name, message: this.messageOf(caught) },
        'error'
      );
      return null;
    });
    return merged ? this.bumpBranchPattern.exec(merged.headRef) : null;
  }

  private async report(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    target: PackagePublishProgress;
    payload: GitHubWorkflowRunWebhookPayload;
  }): Promise<void> {
    const { organizationId, npmRepositoryFullName, target, payload } = input;
    const run = payload.workflow_run;
    const succeeded = run.conclusion === this.conclusions.success;
    try {
      const templates = await this.comments.loadTemplates(organizationId, npmRepositoryFullName);
      if (!templates) {
        log('publish_comment_templates_missing', { organizationId, npmRepository: npmRepositoryFullName }, 'error');
        return;
      }
      const published = await this.comments
        .resolvePublishedPackage(organizationId, target.repositoryFullName, target.sha)
        .catch((caught) => {
          log(
            'published_package_resolve_failed',
            { organizationId, repositoryFullName: target.repositoryFullName, message: this.messageOf(caught) },
            'error'
          );
          return null;
        });
      const values = {
        packageName: published?.name ?? target.repositoryFullName,
        version: published?.version ?? target.sha.slice(0, this.shortShaLength),
        commit: target.sha.slice(0, this.shortShaLength),
        workflowRunUrl: run.html_url,
      };
      const body = this.comments.render(succeeded ? templates.published : templates.publishFailed, values);
      if (target.commentId !== null) {
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
        await createCommitStatus({
          organizationId,
          repositoryFullName: target.repositoryFullName,
          sha: target.headSha,
          state: succeeded ? this.commitStates.success : this.commitStates.failure,
          context: this.publishStatusContext,
          description: succeeded ? `Published ${values.packageName}@${values.version}` : `Failed to publish ${values.packageName}`,
          targetUrl: run.html_url,
        }).catch((caught) =>
          log(
            'publish_status_update_failed',
            { organizationId, repositoryFullName: target.repositoryFullName, message: this.messageOf(caught) },
            'error'
          )
        );
      }
    } catch (caught) {
      log(
        'publish_comment_failed',
        { organizationId, repositoryFullName: target.repositoryFullName, message: this.messageOf(caught) },
        'error'
      );
    }
  }

  async handle(payload: GitHubWorkflowRunWebhookPayload, routedOrganizationId: string | null): Promise<PublishWorkflowRunResult> {
    const run = payload.workflow_run;
    const isCompletedPublish =
      payload.action === this.states.completed && run.name === this.publishWorkflowName && run.status === this.states.completed;
    if (!isCompletedPublish) return { accepted: false, reason: 'event_ignored' };

    const npmRepository = await getTenantNpmRepositoryByRepositoryId(payload.repository.id).catch((caught) => {
      log('publish_npm_repository_load_failed', { repositoryFullName: payload.repository.full_name, message: this.messageOf(caught) }, 'error');
      return null;
    });
    if (!npmRepository?.npmRepositoryFullName) return { accepted: false, reason: 'npm_not_configured' };
    const organizationId = npmRepository.organizationId;
    if (routedOrganizationId && routedOrganizationId !== organizationId) return { accepted: false, unauthorized: true };

    const pending = await this.progress.list(organizationId).catch((caught) => {
      log('publish_progress_load_failed', { organizationId, message: this.messageOf(caught) }, 'error');
      return [];
    });
    if (pending.length === 0) return { accepted: false, reason: 'no_pending_publish' };

    const branchMatch = await this.identifyBumpBranch(payload, organizationId);
    if (!branchMatch) return { accepted: false, reason: 'bump_branch_not_identified' };
    const [, repositoryName, shaPrefix] = branchMatch;
    const target = pending.find(
      (entry) => entry.repositoryFullName.split('/')[1] === repositoryName && entry.sha.startsWith(shaPrefix)
    );
    if (!target) return { accepted: false, reason: 'no_pending_publish' };

    await this.report({ organizationId, npmRepositoryFullName: npmRepository.npmRepositoryFullName, target, payload });
    await this.progress.delete(target.id, organizationId).catch((caught) =>
      log('publish_progress_clear_failed', { organizationId, message: this.messageOf(caught) }, 'error')
    );
    return { accepted: true };
  }
}
