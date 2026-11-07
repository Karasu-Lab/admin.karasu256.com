import 'server-only';
import { join } from 'node:path';
import { createBotPullRequest, getInstallationToken, updateLinkedPackagePointer, type PushWebhookDecision } from './api-auth';
import { commitAll, configureCommitter, createBranch, git, pushBranch, signingKeyConfigured, withClonedRepository } from './git-automation';

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
  if (signingKeyConfigured() && (!decision.signingKeyOwner?.name || !decision.signingKeyOwner?.email)) {
    return { automated: false, reason: 'signing_key_owner_incomplete' };
  }
  const identity = {
    name: decision.signingKeyOwner?.name ?? 'Karasu Lab Admin',
    email: decision.signingKeyOwner?.email ?? 'admin@karasu256.com',
  };
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
      await configureCommitter(dir, identity);
      await commitAll(dir, `chore: bump ${linked.repositoryFullName} to ${afterSha.slice(0, 7)}`);
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
