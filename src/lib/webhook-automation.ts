import 'server-only';
import { join } from 'node:path';
import {
  createBotPullRequest,
  getInstallationToken,
  getUserSigningKeyMaterial,
  updateLinkedPackagePointer,
  type PushWebhookDecision,
} from './api-auth';
import { commitAll, configureCommitter, createBranch, git, pushBranch, withClonedRepository } from './git-automation';

export interface PointerUpdateResult {
  automated: boolean;
  reason?: string;
  pullRequestUrl?: string;
}

export async function runPointerUpdate(
  decision: PushWebhookDecision & { accepted: true },
  afterSha: string
): Promise<PointerUpdateResult> {
  const organizationId = decision.organizationId!;
  const linked = decision.package!;
  const signingUserId = decision.signingUserId;
  if (!signingUserId) return { automated: false, reason: 'signing_user_unknown' };
  let material;
  try {
    material = await getUserSigningKeyMaterial(signingUserId);
  } catch (error) {
    return {
      automated: false,
      reason: `signing_key_unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const identity = { name: material.committerName, email: material.committerEmail };
  const { token } = await getInstallationToken(organizationId);
  const repositoryName = linked.repositoryFullName.split('/')[1] ?? linked.repositoryFullName;
  const branch = `chore/bump-${repositoryName}-${afterSha.slice(0, 7)}`;
  const outcome = await withClonedRepository(
    decision.npmRepositoryFullName!,
    token,
    async (dir) => {
      await createBranch(dir, branch);
      const submoduleDir = join(dir, linked.submodulePath);
      await git(submoduleDir, ['fetch', '--quiet', 'origin']);
      const current = await git(submoduleDir, ['rev-parse', 'HEAD']);
      if (current === afterSha) return 'already_synced' as const;
      await git(submoduleDir, ['checkout', '--quiet', afterSha]);
      const cleanupKey = await configureCommitter(dir, identity, material.privateKey);
      try {
        await commitAll(dir, `chore: bump ${linked.repositoryFullName} to ${afterSha.slice(0, 7)}`);
      } finally {
        await cleanupKey();
      }
      await pushBranch(dir, branch);
      return 'pushed' as const;
    },
    { recurseSubmodules: true }
  );
  if (outcome === 'already_synced') return { automated: false, reason: 'already_synced' };
  const pullRequest = await createBotPullRequest({
    organizationId,
    repositoryFullName: decision.npmRepositoryFullName!,
    title: `Bump ${linked.repositoryFullName} to ${afterSha.slice(0, 7)}`,
    head: branch,
    base: 'main',
    enableAutoMerge: true,
  });
  await updateLinkedPackagePointer(organizationId, linked.id, afterSha);
  return { automated: true, pullRequestUrl: pullRequest.url };
}
