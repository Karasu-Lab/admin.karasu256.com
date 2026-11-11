import 'server-only';
import { z } from 'zod';
import { log } from '@karasu-lab/utils/server';
import { claimDedupeKey, releaseDedupeKey } from './admin-db';
import { getClientConfig } from './client-config';
import { createBotPullRequest } from './git-api';
import { GithubOidcError, GithubOidcVerifier, type GithubOidcClaims } from './github-oidc';
import { getTenantNpmRepositoryByRepositoryId, type TenantNpmRepository } from './npm-repository';
import { PointerUpdateFlow, type PointerResultOutcome } from './pointer-update';
import { SyncBranchPolicy, syncEventSchema, syncResultSchema, syncResultStatusSchema, type SyncEvent, type SyncResult } from './sync-events';

export function pointerResultsErrorSchema() {
  return z.enum(['invalid_payload', 'payload_too_large', 'unauthorized']);
}

export type PointerResultsError = z.infer<ReturnType<typeof pointerResultsErrorSchema>>;

export function mirrorRepositorySchema() {
  return z.object({ organizationId: z.string(), npmRepositoryFullName: z.string() });
}

export type MirrorRepository = z.infer<ReturnType<typeof mirrorRepositorySchema>>;

export class PointerResultsHandler {
  maxBodyBytes = 64 * 1024;
  workflowFileName = 'sync-pointer.yml';
  allowedEventNames = ['repository_dispatch', 'workflow_dispatch'];
  dedupePrefix = 'pointer-result';
  dedupeRetentionMs = 7 * 24 * 60 * 60 * 1000;
  mirrorBaseBranch = 'main';
  packagesDirectory = 'packages/';
  flow = new PointerUpdateFlow();
  branchPolicy = new SyncBranchPolicy();
  syncEvents = syncEventSchema().enum;
  resultStatuses = syncResultStatusSchema().enum;
  errors = pointerResultsErrorSchema().enum;
  packageEventTitles: Partial<Record<SyncEvent, string>> = {
    'link-package': 'Add %name% as a package',
    'unlink-package': 'Remove %name% as a package',
  };

  private errorResponse(error: PointerResultsError, status: number): Response {
    return Response.json({ error }, { status });
  }

  private async readBody(request: Request): Promise<string | null> {
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > this.maxBodyBytes) return null;
    const text = await request.text();
    return new TextEncoder().encode(text).byteLength > this.maxBodyBytes ? null : text;
  }

  private isTrusted(claims: GithubOidcClaims, mirror: TenantNpmRepository & { npmRepositoryFullName: string }): boolean {
    const repository = mirror.npmRepositoryFullName.toLowerCase();
    return (
      claims.repository.toLowerCase() === repository &&
      claims.ref === `refs/heads/${this.mirrorBaseBranch}` &&
      claims.jobWorkflowRef.toLowerCase().startsWith(`${repository}/.github/workflows/${this.workflowFileName}@`) &&
      this.allowedEventNames.includes(claims.eventName)
    );
  }

  private async handlePackageEvent(mirror: MirrorRepository, result: SyncResult): Promise<PointerResultOutcome> {
    const title = this.packageEventTitles[result.event];
    const handlers: Record<SyncResult['status'], () => Promise<PointerResultOutcome>> = {
      [this.resultStatuses.pushed]: async () => {
        const branch = result.branch ?? '';
        if (!title || !this.branchPolicy.isAllowed(result.event, branch)) return { accepted: false };
        const name = (result.path ?? result.repositoryFullName ?? '').split('/').pop() ?? '';
        await createBotPullRequest({
          organizationId: mirror.organizationId,
          repositoryFullName: mirror.npmRepositoryFullName,
          title: title.replace('%name%', name),
          head: branch,
          base: this.mirrorBaseBranch,
          enableAutoMerge: true,
        });
        return { accepted: true };
      },
      [this.resultStatuses.noop]: async () => ({ accepted: true }),
      [this.resultStatuses.failed]: async () => {
        log(
          'package_sync_failed',
          { organizationId: mirror.organizationId, event: result.event, reason: result.reason, path: result.path },
          'error'
        );
        return { accepted: true };
      },
    };
    return handlers[result.status]();
  }

  private async dispatchResult(mirror: MirrorRepository, result: SyncResult): Promise<PointerResultOutcome> {
    const handlers: Record<SyncEvent, () => Promise<PointerResultOutcome>> = {
      [this.syncEvents['pointer-update']]: () =>
        this.flow.handleResult({
          organizationId: mirror.organizationId,
          npmRepositoryFullName: mirror.npmRepositoryFullName,
          result,
        }),
      [this.syncEvents['link-package']]: () => this.handlePackageEvent(mirror, result),
      [this.syncEvents['unlink-package']]: () => this.handlePackageEvent(mirror, result),
    };
    return handlers[result.event]();
  }

  async handle(request: Request): Promise<Response> {
    const body = await this.readBody(request);
    if (body === null) return this.errorResponse(this.errors.payload_too_large, 413);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return this.errorResponse(this.errors.invalid_payload, 400);
    }
    const parsed = syncResultSchema().safeParse(json);
    if (!parsed.success) return this.errorResponse(this.errors.invalid_payload, 400);
    const result = parsed.data;

    let claims: GithubOidcClaims;
    try {
      claims = await new GithubOidcVerifier(new URL(getClientConfig().appUrl).origin).verify(result.oidcToken);
    } catch (caught) {
      log('pointer_result_rejected', { reason: caught instanceof GithubOidcError ? caught.code : 'verification_failed' }, 'error');
      return this.errorResponse(this.errors.unauthorized, 401);
    }
    const registered = await getTenantNpmRepositoryByRepositoryId(claims.repositoryId);
    if (!registered?.npmRepositoryFullName || !this.isTrusted(claims, { ...registered, npmRepositoryFullName: registered.npmRepositoryFullName })) {
      log('pointer_result_rejected', { reason: 'untrusted_claims', repository: claims.repository }, 'error');
      return this.errorResponse(this.errors.unauthorized, 401);
    }
    const mirror = { organizationId: registered.organizationId, npmRepositoryFullName: registered.npmRepositoryFullName };

    const dedupeKey = [this.dedupePrefix, claims.repositoryId, claims.runId, claims.runAttempt, result.event].join(':');
    if (!(await claimDedupeKey(dedupeKey, this.dedupeRetentionMs))) {
      return Response.json({ accepted: true }, { status: 202 });
    }
    try {
      return Response.json(await this.dispatchResult(mirror, result), { status: 202 });
    } catch (caught) {
      await releaseDedupeKey(dedupeKey);
      throw caught;
    }
  }
}
