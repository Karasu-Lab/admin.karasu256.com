import { z } from 'zod';
import { GithubIdentifiers } from './github-identifiers';

export function syncEventSchema() {
  return z.enum(['pointer-update', 'link-package', 'unlink-package']);
}

export type SyncEvent = z.infer<ReturnType<typeof syncEventSchema>>;

export function syncResultStatusSchema() {
  return z.enum(['pushed', 'noop', 'failed']);
}

export type SyncResultStatus = z.infer<ReturnType<typeof syncResultStatusSchema>>;

export function syncFailureReasonSchema() {
  return z.enum(['invalid_payload', 'unsupported_event', 'submodule_not_found', 'push_failed', 'unexpected_error']);
}

export type SyncFailureReason = z.infer<ReturnType<typeof syncFailureReasonSchema>>;

export function pointerUpdateReasonSchema() {
  return z.enum([...syncFailureReasonSchema().options, 'dispatch_failed', 'branch_not_allowed', 'pull_request_failed', 'event_id_required', 'event_not_found']);
}

export type PointerUpdateReason = z.infer<ReturnType<typeof pointerUpdateReasonSchema>>;

export function syncResultSchema() {
  const identifiers = new GithubIdentifiers();
  return z.object({
    oidcToken: z.string().min(1),
    event: syncEventSchema(),
    status: syncResultStatusSchema(),
    reason: syncFailureReasonSchema().optional(),
    eventId: z.string().regex(identifiers.opaqueIdPattern).optional(),
    packageId: z.string().regex(identifiers.opaqueIdPattern).optional(),
    path: z.string().regex(identifiers.submodulePathPattern).optional(),
    sha: z.string().regex(identifiers.commitShaPattern).optional(),
    branch: z.string().optional(),
    repositoryFullName: z.string().regex(identifiers.repositoryFullNamePattern).optional(),
  });
}

export type SyncResult = z.infer<ReturnType<typeof syncResultSchema>>;

export function pointerUpdateDispatchPayloadSchema() {
  return z.object({
    eventId: z.string(),
    packageId: z.string(),
    path: z.string(),
    sha: z.string(),
  });
}

export function linkPackageDispatchPayloadSchema() {
  return z.object({
    repositoryFullName: z.string(),
    defaultBranch: z.string(),
    sha: z.string(),
  });
}

export function unlinkPackageDispatchPayloadSchema() {
  return z.object({ path: z.string() });
}

export class SyncBranchPolicy {
  patterns: Record<SyncEvent, RegExp> = {
    'pointer-update': /^chore\/bump-[A-Za-z0-9._-]+-[0-9a-f]{7}$/,
    'link-package': /^feat\/add-[A-Za-z0-9._-]+-package-[0-9]+$/,
    'unlink-package': /^feat\/remove-[A-Za-z0-9._-]+-package-[0-9]+$/,
  };

  isAllowed(event: SyncEvent, branch: string): boolean {
    return this.patterns[event].test(branch) && new GithubIdentifiers().isBranchName(branch);
  }
}
