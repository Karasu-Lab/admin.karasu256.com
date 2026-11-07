import 'server-only';
import { updateLinkedPackagePointer, type PushWebhookDecision } from './api-auth';
import { createBotPullRequest, requestSignedCommit } from './git-api';
import { seedMirrorIfNeeded } from './mirror-seed';
import type { TenantNpmRepository } from './npm-repository';

export interface PointerUpdateResult {
  automated: boolean;
  reason?: string;
  pullRequestUrl?: string;
}

export async function runPointerUpdate(
  decision: PushWebhookDecision & { accepted: true },
  npmRepository: TenantNpmRepository,
  afterSha: string
): Promise<PointerUpdateResult> {
  const organizationId = decision.organizationId!;
  const linked = decision.package!;
  const signingUserId = decision.signingUserId;
  if (!signingUserId) return { automated: false, reason: 'signing_user_unknown' };
  if (npmRepository.npmRepositoryId === null || !npmRepository.npmRepositoryFullName) {
    return { automated: false, reason: 'npm_not_configured' };
  }
  const npmRepositoryFullName = npmRepository.npmRepositoryFullName;
  const repositoryName = linked.repositoryFullName.split('/')[1] ?? linked.repositoryFullName;
  const branch = `chore/bump-${repositoryName}-${afterSha.slice(0, 7)}`;

  let outcome: string;
  try {
    await seedMirrorIfNeeded({
      repositoryId: npmRepository.npmRepositoryId,
      repositoryFullName: npmRepositoryFullName,
    });
    const result = await requestSignedCommit({
      organizationId,
      signingUserId,
      repositoryId: npmRepository.npmRepositoryId,
      repositoryFullName: npmRepositoryFullName,
      branch,
      message: `chore: bump ${linked.repositoryFullName} to ${afterSha.slice(0, 7)}`,
      gitlinkChanges: [{ path: linked.submodulePath, oid: afterSha }],
      expectGitlinkPath: linked.submodulePath,
    });
    outcome = result.outcome;
  } catch (error) {
    return { automated: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (outcome === 'already_synced' || outcome === 'no_changes') {
    return { automated: false, reason: 'already_synced' };
  }
  if (outcome === 'submodule_not_found') return { automated: false, reason: 'submodule_not_found' };

  const pullRequest = await createBotPullRequest({
    organizationId,
    repositoryFullName: npmRepositoryFullName,
    title: `Bump ${linked.repositoryFullName} to ${afterSha.slice(0, 7)}`,
    head: branch,
    base: 'main',
    enableAutoMerge: true,
  });
  await updateLinkedPackagePointer(organizationId, linked.id, afterSha);
  return { automated: true, pullRequestUrl: pullRequest.url };
}
