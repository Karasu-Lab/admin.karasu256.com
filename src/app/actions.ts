'use server';

import { getSessionUser } from '@karasu-lab/utils/server';
import { DEFAULT_VERSION_NAMING_PATTERN } from '@karasu-lab/types/shared';
import {
  getInstallationToken,
  getTenantOverview,
  linkTenantPackage,
  listUserTenants,
  setTenantPackageEnabled,
  uninstallTenantBot,
  unlinkTenantPackage,
  getGithubAppInstallUrl,
} from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { createBotPullRequest, createTenantRepository, getRepositoryAccess, listTenantRepositories, requestSignedCommit } from '@/lib/git-api';
import { seedMirrorIfNeeded } from '@/lib/mirror-seed';
import {
  deleteTenantNpmRepository,
  getTenantNpmRepository,
  saveTenantNpmRepository,
  type TenantNpmRepository,
} from '@/lib/npm-repository';
import type { InstallationRepository, TenantLinkedPackage, TenantOverview, TenantSummary } from '@/lib/tenants';
import { registerRepository, repositoryRemote, unregisterRepository } from '@/lib/repositories';
import { getTenantSetupCompleted, markTenantSetupCompleted } from '@/lib/setup-completion';
import { getLiveFeed, type LiveFeedData } from '@/lib/update-events';

export type { LiveFeedData, PackageUpdateEvent } from '@/lib/update-events';

export async function getLiveFeedAction(organizationId: string): Promise<LiveFeedData> {
  const userId = await requireUserId();
  await getTenantOverview(organizationId, userId);
  return getLiveFeed(organizationId);
}
import { NPM_REPOSITORY_FILES, packageCiWorkflow, workflowTemplateFiles, type SetupFile } from '@/lib/setup-files';

async function requireUserId(): Promise<string> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) throw new Error('Unauthorized');
  return user.uid;
}

function findExistingRepository(
  repositories: InstallationRepository[],
  owner: string,
  name: string
): InstallationRepository | null {
  const fullName = `${owner}/${name}`.toLowerCase();
  return repositories.find((repository) => repository.fullName.toLowerCase() === fullName) ?? null;
}

function requireReusableRepository(repository: InstallationRepository): InstallationRepository {
  if (repository.private) {
    throw new Error(
      `Repository ${repository.fullName} already exists and is private, so it cannot be used for the npm setup, which requires a public repository`
    );
  }
  return repository;
}

export type RepositorySetupOutcome = 'created' | 'overwritten';

async function createOrReuseRepository(input: {
  organizationId: string;
  userId: string;
  owner: string;
  targetType: 'Organization' | 'User';
  name: string;
  isTemplate?: boolean;
  knownRepositories: InstallationRepository[];
}): Promise<{ repository: InstallationRepository; outcome: RepositorySetupOutcome }> {
  const existing = findExistingRepository(input.knownRepositories, input.owner, input.name);
  if (existing) return { repository: requireReusableRepository(existing), outcome: 'overwritten' };
  try {
    const repository = await createTenantRepository({
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetLogin: input.owner,
      name: input.name,
      private: false,
      isTemplate: input.isTemplate,
    });
    return { repository, outcome: 'created' };
  } catch (caught) {
    const repositories = await listTenantRepositories(input.organizationId).catch(() => []);
    const appeared = findExistingRepository(repositories, input.owner, input.name);
    if (appeared) return { repository: requireReusableRepository(appeared), outcome: 'overwritten' };
    throw caught;
  }
}

async function prepareRepositorySetup(organizationId: string): Promise<{
  userId: string;
  signingUserId: string;
  owner: string;
  targetType: 'Organization' | 'User';
}> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(organizationId, userId);
  if (!overview.installation) throw new Error('github_app_not_installed');
  const signingUserId = overview.installation.installedByUserId;
  if (!signingUserId) throw new Error('signing_user_unknown');
  return {
    userId,
    signingUserId,
    owner: overview.installation.targetLogin,
    targetType: overview.installation.targetType === 'organization' ? 'Organization' : 'User',
  };
}

export async function startNpmRepositorySetupAction(input: {
  organizationId: string;
  npmRepositoryName: string;
}): Promise<{ npmRepositoryFullName: string; outcome: RepositorySetupOutcome }> {
  const { userId, signingUserId, owner, targetType } = await prepareRepositorySetup(input.organizationId);
  const existing = await getTenantNpmRepository(input.organizationId);
  const templateRepositoryName = existing?.workflowTemplateRepositoryName ?? 'workflow-templates';
  await saveTenantNpmRepository({
    organizationId: input.organizationId,
    owner,
    npmRepositoryName: input.npmRepositoryName,
    workflowTemplateRepositoryName: templateRepositoryName,
  });
  const knownRepositories = await listTenantRepositories(input.organizationId);
  const setup = await createOrReuseRepository({
    organizationId: input.organizationId,
    userId,
    owner,
    targetType,
    name: input.npmRepositoryName,
    knownRepositories,
  });
  const npmRepository = setup.repository;
  await saveTenantNpmRepository({
    organizationId: input.organizationId,
    owner,
    npmRepositoryName: input.npmRepositoryName,
    workflowTemplateRepositoryName: templateRepositoryName,
    npmRepositoryId: npmRepository.id,
    npmRepositoryFullName: npmRepository.fullName,
  });
  await registerRepository({
    repositoryId: npmRepository.id,
    remote: repositoryRemote(npmRepository.fullName),
    isPrivate: npmRepository.private,
  });
  await seedRepositoryFiles({
    organizationId: input.organizationId,
    signingUserId,
    repository: npmRepository,
    branch: uniqueBranchName('chore/set-up-release-flow'),
    message: 'chore: set up the release flow',
    pullRequestTitle: 'Set up the release flow',
    files: NPM_REPOSITORY_FILES,
  });
  return { npmRepositoryFullName: npmRepository.fullName, outcome: setup.outcome };
}

export async function startTemplateRepositorySetupAction(input: {
  organizationId: string;
  templateRepositoryName: string;
}): Promise<{ templateRepositoryFullName: string; outcome: RepositorySetupOutcome }> {
  const { userId, signingUserId, owner, targetType } = await prepareRepositorySetup(input.organizationId);
  const existing = await getTenantNpmRepository(input.organizationId);
  const npmRepositoryName = existing?.npmRepositoryName ?? 'npm';
  await saveTenantNpmRepository({
    organizationId: input.organizationId,
    owner,
    npmRepositoryName,
    workflowTemplateRepositoryName: input.templateRepositoryName,
  });
  const knownRepositories = await listTenantRepositories(input.organizationId);
  const setup = await createOrReuseRepository({
    organizationId: input.organizationId,
    userId,
    owner,
    targetType,
    name: input.templateRepositoryName,
    isTemplate: true,
    knownRepositories,
  });
  const templateRepository = setup.repository;
  await saveTenantNpmRepository({
    organizationId: input.organizationId,
    owner,
    npmRepositoryName,
    workflowTemplateRepositoryName: input.templateRepositoryName,
    workflowTemplateRepositoryId: templateRepository.id,
    workflowTemplateRepositoryFullName: templateRepository.fullName,
  });
  await registerRepository({
    repositoryId: templateRepository.id,
    remote: repositoryRemote(templateRepository.fullName),
    isPrivate: templateRepository.private,
  });
  await seedRepositoryFiles({
    organizationId: input.organizationId,
    signingUserId,
    repository: templateRepository,
    branch: uniqueBranchName('chore/set-up-shared-ci-workflow'),
    message: 'chore: set up the shared CI workflow',
    pullRequestTitle: 'Set up the shared CI workflow',
    files: workflowTemplateFiles(templateRepository.fullName),
  });
  return { templateRepositoryFullName: templateRepository.fullName, outcome: setup.outcome };
}

function uniqueBranchName(base: string): string {
  return `${base}-${crypto.randomUUID()}`;
}

async function seedRepositoryFiles(input: {
  organizationId: string;
  signingUserId: string;
  repository: InstallationRepository;
  branch: string;
  message: string;
  pullRequestTitle: string;
  files: SetupFile[];
}): Promise<void> {
  const baseBranch = input.repository.defaultBranch || 'main';
  await seedMirrorIfNeeded({ repositoryId: input.repository.id, repositoryFullName: input.repository.fullName });
  const result = await requestSignedCommit({
    organizationId: input.organizationId,
    signingUserId: input.signingUserId,
    repositoryId: input.repository.id,
    repositoryFullName: input.repository.fullName,
    branch: input.branch,
    baseBranch,
    message: input.message,
    fileChanges: input.files,
  });
  if (result.outcome !== 'pushed') return;
  await createBotPullRequest({
    organizationId: input.organizationId,
    repositoryFullName: input.repository.fullName,
    title: input.pullRequestTitle,
    head: input.branch,
    base: baseBranch,
    enableAutoMerge: true,
  });
}

interface PackageManifest {
  versionNaming?: { pattern?: string };
}

async function githubGet(token: string, path: string): Promise<Response> {
  return fetch(`https://api.github.com/repos/${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'karasu-lab-admin',
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });
}

async function readManifestRaw(
  token: string,
  repositoryFullName: string
): Promise<Record<string, unknown> | null> {
  const response = await githubGet(token, `${repositoryFullName}/contents/package.json`);
  if (!response.ok) return null;
  const data = (await response.json()) as { content?: string };
  if (!data.content) return null;
  try {
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function repositoryFileExists(token: string, repositoryFullName: string, path: string): Promise<boolean> {
  const response = await githubGet(token, `${repositoryFullName}/contents/${path}`);
  return response.ok;
}

async function repositoryHeadOid(token: string, repositoryFullName: string, branch: string): Promise<string> {
  const response = await githubGet(token, `${repositoryFullName}/git/ref/heads/${branch}`);
  if (!response.ok) {
    throw new Error(`Resolving the head of ${repositoryFullName}@${branch} failed (${response.status})`);
  }
  const data = (await response.json()) as { object?: { sha?: unknown } };
  if (typeof data.object?.sha !== 'string') {
    throw new Error(`Resolving the head of ${repositoryFullName}@${branch} returned no commit SHA`);
  }
  return data.object.sha;
}

export async function linkPackageAction(input: {
  organizationId: string;
  repositoryId: number;
  repositoryFullName: string;
  defaultBranch: string;
  private: boolean;
}): Promise<{ versionNaming: string; linkedPackages: TenantLinkedPackage[] }> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(input.organizationId, userId);
  if (!overview.installation) throw new Error('github_app_not_installed');
  const npmRepository = await getTenantNpmRepository(input.organizationId);
  if (
    !npmRepository?.npmRepositoryFullName ||
    npmRepository.npmRepositoryId === null ||
    !npmRepository.workflowTemplateRepositoryFullName
  ) {
    throw new Error('npm_not_configured');
  }
  if (
    input.repositoryFullName === npmRepository.npmRepositoryFullName ||
    input.repositoryFullName === npmRepository.workflowTemplateRepositoryFullName
  ) {
    throw new Error('setup_repository_cannot_be_linked');
  }
  const signerUserId = overview.installation.installedByUserId;
  if (!signerUserId) throw new Error('signing_user_unknown');

  await registerRepository({
    repositoryId: input.repositoryId,
    remote: repositoryRemote(input.repositoryFullName),
    isPrivate: input.private,
  });
  const targetAccess = await getRepositoryAccess(input.repositoryId);
  if (!targetAccess.allowed) {
    throw new Error(
      `Repository ${input.repositoryFullName} is private and cannot be linked: the git service blocks private repositories (visibility: ${targetAccess.visibility ?? 'unknown'}, reason: ${targetAccess.reason ?? 'not_allowed'})`
    );
  }
  const npmAccess = await getRepositoryAccess(npmRepository.npmRepositoryId);
  if (!npmAccess.allowed) {
    throw new Error(
      `Repository ${npmRepository.npmRepositoryFullName} is private and cannot receive packages: the git service blocks private repositories (visibility: ${npmAccess.visibility ?? 'unknown'}, reason: ${npmAccess.reason ?? 'not_allowed'})`
    );
  }

  const token = await getInstallationToken(input.organizationId);
  const rawManifest = await readManifestRaw(token.token, input.repositoryFullName);
  if (!rawManifest) throw new Error('package_json_not_found');
  const manifest = rawManifest as PackageManifest;
  let pattern = manifest.versionNaming?.pattern ?? null;
  const needsDeclaration = !pattern;
  if (!pattern) pattern = DEFAULT_VERSION_NAMING_PATTERN;

  const repositoryName = input.repositoryFullName.split('/')[1] ?? input.repositoryFullName;
  const setupBranch = uniqueBranchName('chore/package-setup');
  const fileChanges: { path: string; content: string }[] = [];
  if (needsDeclaration) {
    fileChanges.push({
      path: 'package.json',
      content: `${JSON.stringify({ ...rawManifest, versionNaming: { pattern } }, null, 2)}\n`,
    });
  }
  if (!(await repositoryFileExists(token.token, input.repositoryFullName, '.github/workflows/ci.yml'))) {
    fileChanges.push({
      path: '.github/workflows/ci.yml',
      content: packageCiWorkflow(npmRepository.workflowTemplateRepositoryFullName),
    });
  }
  let changed = false;
  if (fileChanges.length > 0) {
    await seedMirrorIfNeeded({ repositoryId: input.repositoryId, repositoryFullName: input.repositoryFullName });
    const result = await requestSignedCommit({
      organizationId: input.organizationId,
      signingUserId: signerUserId,
      repositoryId: input.repositoryId,
      repositoryFullName: input.repositoryFullName,
      branch: setupBranch,
      baseBranch: input.defaultBranch,
      message: 'chore: set up CI and the version naming scheme',
      fileChanges,
    });
    changed = result.outcome === 'pushed';
  }
  if (changed) {
    await createBotPullRequest({
      organizationId: input.organizationId,
      repositoryFullName: input.repositoryFullName,
      title: 'Set up CI and the version naming scheme',
      head: setupBranch,
      base: input.defaultBranch,
      enableAutoMerge: true,
    });
  }

  const npmFullName = npmRepository.npmRepositoryFullName;
  const submodulePath = `packages/${repositoryName}`;
  const addBranch = uniqueBranchName(`feat/add-${repositoryName}-package`);
  const packageHeadOid = await repositoryHeadOid(token.token, input.repositoryFullName, input.defaultBranch);
  await seedMirrorIfNeeded({ repositoryId: npmRepository.npmRepositoryId, repositoryFullName: npmFullName });
  const addResult = await requestSignedCommit({
    organizationId: input.organizationId,
    signingUserId: signerUserId,
    repositoryId: npmRepository.npmRepositoryId,
    repositoryFullName: npmFullName,
    branch: addBranch,
    baseBranch: 'main',
    message: `feat: add ${input.repositoryFullName} as a package`,
    gitlinkChanges: [{ path: submodulePath, oid: packageHeadOid }],
    gitmodulesAdditions: [
      { path: submodulePath, url: repositoryRemote(input.repositoryFullName), branch: input.defaultBranch },
    ],
  });
  if (addResult.outcome === 'pushed') {
    await createBotPullRequest({
      organizationId: input.organizationId,
      repositoryFullName: npmFullName,
      title: `Add ${repositoryName} as a package`,
      head: addBranch,
      base: 'main',
      enableAutoMerge: true,
    });
  } else if (addResult.outcome !== 'no_changes' && addResult.outcome !== 'already_synced') {
    throw new Error(`npm_repository_update_${addResult.outcome}`);
  }

  await linkTenantPackage(input.organizationId, {
    userId,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    submodulePath,
    versionNaming: pattern,
  });
  const overviewAfterLink = await getTenantOverview(input.organizationId, userId);
  const refreshed = await reconcileLinkedPackages({
    organizationId: input.organizationId,
    userId,
    overview: overviewAfterLink,
    npmRepository,
  });
  return { versionNaming: pattern, linkedPackages: refreshed.linkedPackages };
}

export async function setPackageEnabledAction(input: {
  organizationId: string;
  packageId: string;
  enabled: boolean;
}): Promise<void> {
  const userId = await requireUserId();
  await setTenantPackageEnabled(input.organizationId, input.packageId, { userId, enabled: input.enabled });
}

export async function unlinkPackageAction(input: { organizationId: string; packageId: string }): Promise<void> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(input.organizationId, userId);
  if (overview.organization.role !== 'owner' && overview.organization.role !== 'admin') {
    throw new Error('tenant_setup_role_required');
  }
  if (!overview.installation) throw new Error('github_app_not_installed');
  const signerUserId = overview.installation.installedByUserId;
  if (!signerUserId) throw new Error('signing_user_unknown');
  const linked = overview.linkedPackages.find((entry) => entry.id === input.packageId);
  if (!linked) throw new Error('linked_package_not_found');
  const npmRepository = await getTenantNpmRepository(input.organizationId);
  if (!npmRepository?.npmRepositoryFullName || npmRepository.npmRepositoryId === null) {
    throw new Error('npm_not_configured');
  }
  const npmFullName = npmRepository.npmRepositoryFullName;
  const repositoryName = linked.repositoryFullName.split('/')[1] ?? linked.repositoryFullName;
  const removeBranch = uniqueBranchName(`feat/remove-${repositoryName}-package`);
  await seedMirrorIfNeeded({ repositoryId: npmRepository.npmRepositoryId, repositoryFullName: npmFullName });
  const removeResult = await requestSignedCommit({
    organizationId: input.organizationId,
    signingUserId: signerUserId,
    repositoryId: npmRepository.npmRepositoryId,
    repositoryFullName: npmFullName,
    branch: removeBranch,
    baseBranch: 'main',
    message: `feat: remove ${linked.repositoryFullName} as a package`,
    gitlinkRemovals: [linked.submodulePath],
    gitmodulesRemovals: [linked.submodulePath],
  });
  if (removeResult.outcome === 'pushed') {
    await createBotPullRequest({
      organizationId: input.organizationId,
      repositoryFullName: npmFullName,
      title: `Remove ${repositoryName} as a package`,
      head: removeBranch,
      base: 'main',
      enableAutoMerge: true,
    });
  } else if (removeResult.outcome !== 'no_changes' && removeResult.outcome !== 'already_synced') {
    throw new Error(`npm_repository_update_${removeResult.outcome}`);
  }
  await unlinkTenantPackage(input.organizationId, input.packageId, { userId });
}

export async function getGithubAppInstallUrlAction(): Promise<string> {
  await requireUserId();
  return getGithubAppInstallUrl();
}

export async function uninstallBotAction(organizationId: string): Promise<void> {
  const userId = await requireUserId();
  await uninstallTenantBot(organizationId, { userId });
}

export async function unlinkNpmSetupAction(organizationId: string): Promise<void> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(organizationId, userId);
  if (overview.organization.role !== 'owner' && overview.organization.role !== 'admin') {
    throw new Error('tenant_setup_role_required');
  }
  const npmRepository = await getTenantNpmRepository(organizationId);
  if (!npmRepository) return;
  if (npmRepository.npmRepositoryId !== null) await unregisterRepository(npmRepository.npmRepositoryId);
  if (npmRepository.workflowTemplateRepositoryId !== null) {
    await unregisterRepository(npmRepository.workflowTemplateRepositoryId);
  }
  await deleteTenantNpmRepository(organizationId);
}

export interface DashboardData {
  signedIn: boolean;
  tenants: TenantSummary[];
  selected: TenantSummary | null;
  overview: TenantOverview | null;
  npmRepository: TenantNpmRepository | null;
  repositories: InstallationRepository[];
  setupCompleted: boolean;
}

export async function markSetupCompletedAction(organizationId: string): Promise<void> {
  const userId = await requireUserId();
  await getTenantOverview(organizationId, userId);
  await markTenantSetupCompleted(organizationId);
}

async function readRepositorySubmodules(
  token: string,
  repositoryFullName: string
): Promise<{ path: string; repositoryFullName: string }[]> {
  const response = await githubGet(token, `${repositoryFullName}/contents/.gitmodules`);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(
      new Error(`failed to read .gitmodules of ${repositoryFullName}: GitHub responded ${response.status}${body ? `: ${body}` : ''}`)
    );
    return [];
  }
  const data = (await response.json()) as { content?: string };
  if (!data.content) return [];
  const text = Buffer.from(data.content, 'base64').toString('utf8');
  const submodules: { path: string; repositoryFullName: string }[] = [];
  const sectionPattern = /\[submodule "[^"]+"\]\s*\n\s*path = ([^\n]+)\n\s*url = ([^\n]+)/g;
  for (const match of text.matchAll(sectionPattern)) {
    const path = match[1].trim();
    const fullName = match[2].trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
    if (path && fullName.includes('/')) submodules.push({ path, repositoryFullName: fullName });
  }
  return submodules;
}

async function reconcileLinkedPackages(input: {
  organizationId: string;
  userId: string;
  overview: TenantOverview;
  npmRepository: TenantNpmRepository | null;
}): Promise<TenantOverview> {
  const { organizationId, userId, overview, npmRepository } = input;
  if (!overview.installation || !npmRepository?.npmRepositoryFullName) return overview;
  try {
    const repositories = await listTenantRepositories(organizationId);
    if (!repositories.some((repository) => repository.fullName === npmRepository.npmRepositoryFullName)) {
      console.error(
        new Error(`linked package reconciliation cannot run: the installation cannot access the npm repository ${npmRepository.npmRepositoryFullName}`)
      );
      return overview;
    }
    const { token } = await getInstallationToken(organizationId);
    const submodules = await readRepositorySubmodules(token, npmRepository.npmRepositoryFullName);
    const linkedNames = new Set(overview.linkedPackages.map((linked) => linked.repositoryFullName));
    const missing = submodules.filter((submodule) => !linkedNames.has(submodule.repositoryFullName));
    if (missing.length === 0) return overview;
    const byFullName = new Map(repositories.map((repository) => [repository.fullName, repository]));
    let registered = false;
    for (const submodule of missing) {
      const repository = byFullName.get(submodule.repositoryFullName);
      if (!repository) continue;
      try {
        await registerRepository({
          repositoryId: repository.id,
          remote: repositoryRemote(repository.fullName),
          isPrivate: repository.private,
        });
        const access = await getRepositoryAccess(repository.id);
        if (!access.allowed) {
          console.warn(
            `linked package reconciliation skipped ${repository.fullName}: the git service does not allow it (visibility: ${access.visibility ?? 'unknown'}, reason: ${access.reason ?? 'not_allowed'})`
          );
          continue;
        }
        const manifest = await readManifestRaw(token, repository.fullName);
        const declared = (manifest as PackageManifest | null)?.versionNaming?.pattern;
        await linkTenantPackage(organizationId, {
          userId,
          repositoryId: repository.id,
          repositoryFullName: repository.fullName,
          submodulePath: submodule.path,
          versionNaming: declared ?? DEFAULT_VERSION_NAMING_PATTERN,
        });
        registered = true;
      } catch (caught) {
        console.error(
          caught instanceof Error
            ? new Error(`linked package reconciliation failed for ${submodule.repositoryFullName}: ${caught.message}`)
            : caught
        );
        continue;
      }
    }
    if (!registered) return overview;
    return await getTenantOverview(organizationId, userId);
  } catch (caught) {
    console.error(caught instanceof Error ? new Error(`linked package reconciliation failed: ${caught.message}`) : caught);
    return overview;
  }
}

export async function getDashboardDataAction(tenantId?: string): Promise<DashboardData> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) {
    return { signedIn: false, tenants: [], selected: null, overview: null, npmRepository: null, repositories: [], setupCompleted: false };
  }
  const tenants = await listUserTenants(user.uid);
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) {
    return { signedIn: true, tenants, selected: null, overview: null, npmRepository: null, repositories: [], setupCompleted: false };
  }
  const [loadedOverview, npmRepository, setupCompleted] = await Promise.all([
    getTenantOverview(selected.id, user.uid),
    getTenantNpmRepository(selected.id),
    getTenantSetupCompleted(selected.id),
  ]);
  const overview = await reconcileLinkedPackages({ organizationId: selected.id, userId: user.uid, overview: loadedOverview, npmRepository });
  const repositories = overview.installation ? await listTenantRepositories(selected.id) : [];
  return { signedIn: true, tenants, selected, overview, npmRepository, repositories, setupCompleted };
}

export interface SetupData {
  signedIn: boolean;
  selected: TenantSummary | null;
  overview: TenantOverview | null;
  npmRepository: TenantNpmRepository | null;
  repositories: InstallationRepository[];
}

export async function getSetupDataAction(tenantId?: string): Promise<SetupData> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) {
    return { signedIn: false, selected: null, overview: null, npmRepository: null, repositories: [] };
  }
  const tenants = await listUserTenants(user.uid);
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) {
    return { signedIn: true, selected: null, overview: null, npmRepository: null, repositories: [] };
  }
  const [overview, npmRepository] = await Promise.all([
    getTenantOverview(selected.id, user.uid),
    getTenantNpmRepository(selected.id),
  ]);
  const repositories = overview.installation ? await listTenantRepositories(selected.id) : [];
  return { signedIn: true, selected, overview, npmRepository, repositories };
}

export interface TenantSettingsData {
  overview: TenantOverview;
  npmRepository: TenantNpmRepository | null;
}

export async function getTenantSettingsDataAction(organizationId: string): Promise<TenantSettingsData> {
  const userId = await requireUserId();
  const [loadedOverview, npmRepository] = await Promise.all([
    getTenantOverview(organizationId, userId),
    getTenantNpmRepository(organizationId),
  ]);
  const overview = await reconcileLinkedPackages({ organizationId, userId, overview: loadedOverview, npmRepository });
  return { overview, npmRepository };
}

export interface PackagesData {
  signedIn: boolean;
  selected: TenantSummary | null;
  overview: TenantOverview | null;
}

export async function getPackagesDataAction(tenantId?: string): Promise<PackagesData> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) {
    return { signedIn: false, selected: null, overview: null };
  }
  const tenants = await listUserTenants(user.uid);
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) {
    return { signedIn: true, selected: null, overview: null };
  }
  const { overview } = await getTenantSettingsDataAction(selected.id);
  return { signedIn: true, selected, overview };
}

export interface TenantProfileData {
  name: string;
  slug: string;
}

export async function getTenantProfileAction(organizationId: string): Promise<TenantProfileData> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(organizationId, userId);
  return { name: overview.organization.name, slug: overview.organization.slug };
}
