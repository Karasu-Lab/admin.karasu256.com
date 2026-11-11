import 'server-only';
import { z } from 'zod';
import { log } from '@karasu-lab/utils/server';
import { updateLinkedPackagePointer } from './api-auth';
import {
  commitStatusStateSchema,
  createBotPullRequest,
  createCommitStatus,
  createIssueComment,
  dispatchRepositoryEvent,
  findMergedPullRequestByCommit,
  updateIssueComment,
} from './git-api';
import { PublishComments, PublishProgress } from './publish-progress';
import {
  pointerUpdateDispatchPayloadSchema,
  pointerUpdateReasonSchema,
  syncEventSchema,
  SyncBranchPolicy,
  syncResultStatusSchema,
  type PointerUpdateReason,
  type SyncResult,
} from './sync-events';
import { PackageUpdateEvents, packageUpdateStatusSchema, type PackageUpdateRecord } from './update-events';

export function pointerUpdateStartInputSchema() {
  return z.object({
    organizationId: z.string(),
    package: z.object({
      id: z.string(),
      repositoryFullName: z.string(),
      submodulePath: z.string(),
      lastSyncedSha: z.string().nullable(),
    }),
    npmRepositoryFullName: z.string(),
    afterSha: z.string(),
  });
}

export type PointerUpdateStartInput = z.infer<ReturnType<typeof pointerUpdateStartInputSchema>>;

export function pointerUpdateStartResultSchema() {
  return z.object({ dispatched: z.boolean(), reason: pointerUpdateReasonSchema().optional() });
}

export type PointerUpdateStartResult = z.infer<ReturnType<typeof pointerUpdateStartResultSchema>>;

export function pointerResultOutcomeSchema() {
  return z.object({ accepted: z.boolean(), reason: pointerUpdateReasonSchema().optional() });
}

export type PointerResultOutcome = z.infer<ReturnType<typeof pointerResultOutcomeSchema>>;

export function pointerStageOutcomeSchema() {
  return z.enum(['completed', 'failed']);
}

export type PointerStageOutcome = z.infer<ReturnType<typeof pointerStageOutcomeSchema>>;

export class PointerUpdateFlow {
  pointerUpdateStatusContext = 'Pointer update';
  publishStatusContext = 'Publish';
  mirrorBaseBranch = 'main';
  shortShaLength = 7;
  events = new PackageUpdateEvents();
  comments = new PublishComments();
  progress = new PublishProgress();
  branchPolicy = new SyncBranchPolicy();
  syncEvents = syncEventSchema().enum;
  resultStatuses = syncResultStatusSchema().enum;
  updateStatuses = packageUpdateStatusSchema().enum;
  stageOutcomes = pointerStageOutcomeSchema().enum;
  commitStates = commitStatusStateSchema().enum;
  reasons = pointerUpdateReasonSchema().enum;

  private shortSha(sha: string): string {
    return sha.slice(0, this.shortShaLength);
  }

  private messageOf(caught: unknown): string {
    return caught instanceof Error ? caught.message : String(caught);
  }

  private async announce(input: PointerUpdateStartInput, eventId: string): Promise<void> {
    const { organizationId, afterSha, npmRepositoryFullName } = input;
    const repositoryFullName = input.package.repositoryFullName;
    try {
      const found = await findMergedPullRequestByCommit({ organizationId, repositoryFullName, sha: afterSha });
      if (!found) return;
      const templates = await this.comments.loadTemplates(organizationId, npmRepositoryFullName);
      let commentId: number | null = null;
      if (templates?.pointerUpdating) {
        const comment = await createIssueComment({
          organizationId,
          repositoryFullName,
          issueNumber: found.number,
          body: this.comments.render(templates.pointerUpdating, {
            npmRepository: npmRepositoryFullName,
            commit: this.shortSha(afterSha),
          }),
        });
        commentId = comment.id;
      }
      await createCommitStatus({
        organizationId,
        repositoryFullName,
        sha: found.headSha,
        state: this.commitStates.pending,
        context: this.pointerUpdateStatusContext,
        description: `Updating ${repositoryFullName} to ${this.shortSha(afterSha)}`,
      }).catch((caught) =>
        log('pointer_update_status_failed', { organizationId, repositoryFullName, message: this.messageOf(caught) }, 'error')
      );
      await this.events.setContext(eventId, organizationId, {
        sourcePullRequestNumber: found.number,
        sourceHeadSha: found.headSha,
        pointerCommentId: commentId,
      });
    } catch (caught) {
      log('pointer_update_start_comment_failed', { organizationId, repositoryFullName, message: this.messageOf(caught) }, 'error');
    }
  }

  async start(rawInput: PointerUpdateStartInput): Promise<PointerUpdateStartResult> {
    const input = pointerUpdateStartInputSchema().parse(rawInput);
    const { organizationId, afterSha, npmRepositoryFullName } = input;
    const eventId = await this.events.start({
      organizationId,
      packageId: input.package.id,
      repositoryFullName: input.package.repositoryFullName,
      fromSha: input.package.lastSyncedSha,
      toSha: afterSha,
    });
    await this.announce(input, eventId);
    try {
      await dispatchRepositoryEvent({
        organizationId,
        repositoryFullName: npmRepositoryFullName,
        eventType: this.syncEvents['pointer-update'],
        clientPayload: pointerUpdateDispatchPayloadSchema().parse({
          eventId,
          packageId: input.package.id,
          path: input.package.submodulePath,
          sha: afterSha,
        }),
      });
      return { dispatched: true };
    } catch (caught) {
      log('pointer_update_dispatch_failed', { organizationId, eventId, message: this.messageOf(caught) }, 'error');
      const record = await this.events.get(eventId, organizationId);
      if (record) await this.fail({ organizationId, npmRepositoryFullName, record, reason: this.reasons.dispatch_failed });
      return { dispatched: false, reason: this.reasons.dispatch_failed };
    }
  }

  private async finishStage(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    record: PackageUpdateRecord;
    outcome: PointerStageOutcome;
    pullRequestUrl: string | null;
  }): Promise<void> {
    const { organizationId, npmRepositoryFullName, record, outcome, pullRequestUrl } = input;
    if (record.sourcePullRequestNumber === null || record.sourceHeadSha === null) return;
    const succeeded = outcome === this.stageOutcomes.completed;
    try {
      if (record.pointerCommentId !== null) {
        const templates = await this.comments.loadTemplates(organizationId, npmRepositoryFullName);
        const template = succeeded ? templates?.pointerUpdate : templates?.pointerUpdateFailed;
        if (template) {
          await updateIssueComment({
            organizationId,
            repositoryFullName: record.repositoryFullName,
            commentId: record.pointerCommentId,
            body: this.comments.render(template, {
              pullRequestUrl: pullRequestUrl ?? '',
              npmRepository: npmRepositoryFullName,
              commit: this.shortSha(record.toSha),
            }),
          });
        }
      }
      await createCommitStatus({
        organizationId,
        repositoryFullName: record.repositoryFullName,
        sha: record.sourceHeadSha,
        state: succeeded ? this.commitStates.success : this.commitStates.failure,
        context: this.pointerUpdateStatusContext,
        description: succeeded
          ? `Updated ${record.repositoryFullName} to ${this.shortSha(record.toSha)}`
          : `Failed to update ${record.repositoryFullName}`,
        targetUrl: pullRequestUrl ?? undefined,
      });
    } catch (caught) {
      log(
        'pointer_update_stage_finish_failed',
        { organizationId, repositoryFullName: record.repositoryFullName, message: this.messageOf(caught) },
        'error'
      );
    }
  }

  private async startPublishStage(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    record: PackageUpdateRecord;
    pullRequestUrl: string;
  }): Promise<void> {
    const { organizationId, npmRepositoryFullName, record, pullRequestUrl } = input;
    if (record.sourcePullRequestNumber === null || record.sourceHeadSha === null) return;
    try {
      const progressId = await this.progress.record({
        organizationId,
        packageId: record.packageId,
        repositoryFullName: record.repositoryFullName,
        sha: record.toSha,
        sourcePullRequestNumber: record.sourcePullRequestNumber,
        bumpPullRequestUrl: pullRequestUrl,
        headSha: record.sourceHeadSha,
      });
      const templates = await this.comments.loadTemplates(organizationId, npmRepositoryFullName);
      if (!templates) {
        log('publish_comment_templates_missing', { organizationId, npmRepository: npmRepositoryFullName }, 'error');
        return;
      }
      if (templates.publishing) {
        const comment = await createIssueComment({
          organizationId,
          repositoryFullName: record.repositoryFullName,
          issueNumber: record.sourcePullRequestNumber,
          body: this.comments.render(templates.publishing, {
            pullRequestUrl,
            npmRepository: npmRepositoryFullName,
            commit: this.shortSha(record.toSha),
          }),
        });
        await this.progress.setComment(progressId, organizationId, comment.id);
      }
      await createCommitStatus({
        organizationId,
        repositoryFullName: record.repositoryFullName,
        sha: record.sourceHeadSha,
        state: this.commitStates.pending,
        context: this.publishStatusContext,
        description: `Publishing ${record.repositoryFullName}`,
        targetUrl: pullRequestUrl,
      }).catch((caught) =>
        log('publish_status_failed', { organizationId, repositoryFullName: record.repositoryFullName, message: this.messageOf(caught) }, 'error')
      );
    } catch (caught) {
      log(
        'pointer_update_comment_failed',
        { organizationId, repositoryFullName: record.repositoryFullName, message: this.messageOf(caught) },
        'error'
      );
    }
  }

  private async fail(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    record: PackageUpdateRecord;
    reason: PointerUpdateReason;
  }): Promise<void> {
    const { organizationId, npmRepositoryFullName, record, reason } = input;
    await this.events
      .finish(record.id, organizationId, this.updateStatuses.failed, reason)
      .catch((caught) => log('update_result_record_failed', { organizationId, message: this.messageOf(caught) }, 'error'));
    await this.finishStage({ organizationId, npmRepositoryFullName, record, outcome: this.stageOutcomes.failed, pullRequestUrl: null });
  }

  private async onPushed(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    record: PackageUpdateRecord;
    result: SyncResult;
  }): Promise<PointerResultOutcome> {
    const { organizationId, npmRepositoryFullName, record, result } = input;
    const branch = result.branch ?? '';
    if (!this.branchPolicy.isAllowed(this.syncEvents['pointer-update'], branch)) {
      await this.fail({ organizationId, npmRepositoryFullName, record, reason: this.reasons.branch_not_allowed });
      return { accepted: false, reason: this.reasons.branch_not_allowed };
    }
    try {
      const pullRequest = await createBotPullRequest({
        organizationId,
        repositoryFullName: npmRepositoryFullName,
        title: `Bump ${record.repositoryFullName} to ${this.shortSha(record.toSha)}`,
        head: branch,
        base: this.mirrorBaseBranch,
        enableAutoMerge: true,
      });
      await updateLinkedPackagePointer(organizationId, record.packageId, record.toSha);
      await this.events.finish(record.id, organizationId, this.updateStatuses.completed);
      await this.finishStage({
        organizationId,
        npmRepositoryFullName,
        record,
        outcome: this.stageOutcomes.completed,
        pullRequestUrl: pullRequest.url,
      });
      await this.startPublishStage({ organizationId, npmRepositoryFullName, record, pullRequestUrl: pullRequest.url });
      return { accepted: true };
    } catch (caught) {
      log('pointer_update_pull_request_failed', { organizationId, eventId: record.id, message: this.messageOf(caught) }, 'error');
      await this.fail({ organizationId, npmRepositoryFullName, record, reason: this.reasons.pull_request_failed });
      return { accepted: false, reason: this.reasons.pull_request_failed };
    }
  }

  private async onNoop(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    record: PackageUpdateRecord;
  }): Promise<PointerResultOutcome> {
    const { organizationId, npmRepositoryFullName, record } = input;
    await this.events.finish(record.id, organizationId, this.updateStatuses.completed);
    await this.finishStage({ organizationId, npmRepositoryFullName, record, outcome: this.stageOutcomes.completed, pullRequestUrl: null });
    return { accepted: true };
  }

  private async onFailed(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    record: PackageUpdateRecord;
    result: SyncResult;
  }): Promise<PointerResultOutcome> {
    const reason = pointerUpdateReasonSchema().safeParse(input.result.reason);
    await this.fail({
      organizationId: input.organizationId,
      npmRepositoryFullName: input.npmRepositoryFullName,
      record: input.record,
      reason: reason.success ? reason.data : this.reasons.unexpected_error,
    });
    return { accepted: true };
  }

  async handleResult(input: {
    organizationId: string;
    npmRepositoryFullName: string;
    result: SyncResult;
  }): Promise<PointerResultOutcome> {
    const { organizationId, npmRepositoryFullName, result } = input;
    if (!result.eventId) return { accepted: false, reason: this.reasons.event_id_required };
    const record = await this.events.get(result.eventId, organizationId);
    if (!record) return { accepted: false, reason: this.reasons.event_not_found };
    if (record.status !== this.updateStatuses.processing) return { accepted: true };
    const handlers: Record<SyncResult['status'], () => Promise<PointerResultOutcome>> = {
      [this.resultStatuses.pushed]: () => this.onPushed({ organizationId, npmRepositoryFullName, record, result }),
      [this.resultStatuses.noop]: () => this.onNoop({ organizationId, npmRepositoryFullName, record }),
      [this.resultStatuses.failed]: () => this.onFailed({ organizationId, npmRepositoryFullName, record, result }),
    };
    return handlers[result.status]();
  }
}
