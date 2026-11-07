'use server';

import { getSessionUser } from '@karasu-lab/utils/server';
import { DEFAULT_VERSION_NAMING_PATTERN } from '@karasu-lab/types/shared';
import {
  createBotPullRequest,
  createTenantRepository,
  getInstallationToken,
  getTenantOverview,
  linkTenantPackage,
  listTenantRepositories,
  listUserTenants,
  setTenantPackageEnabled,
} from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getRepositoryAccess, requestSignedCommit } from '@/lib/git-api';
import { seedMirrorIfNeeded } from '@/lib/mirror-seed';
import { getTenantNpmRepository, saveTenantNpmRepository, type TenantNpmRepository } from '@/lib/npm-repository';
import type { InstallationRepository, TenantOverview, TenantSummary } from '@/lib/tenants';
import { registerRepository, repositoryRemote } from '@/lib/repositories';

async function requireUserId(): Promise<string> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) throw new Error('Unauthorized');
  return user.uid;
}

export async function startNpmSetupAction(input: {
  organizationId: string;
  npmRepositoryName: string;
  templateRepositoryName: string;
}): Promise<{ npmRepositoryFullName: string; templateRepositoryFullName: string }> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(input.organizationId, userId);
  if (!overview.installation) throw new Error('github_app_not_installed');
  const owner = overview.installation.targetLogin;
  await saveTenantNpmRepository({
    organizationId: input.organizationId,
    owner,
    npmRepositoryName: input.npmRepositoryName,
    workflowTemplateRepositoryName: input.templateRepositoryName,
  });
  const npmRepository = await createTenantRepository(input.organizationId, {
    userId,
    name: input.npmRepositoryName,
    private: false,
  });
  const templateRepository = await createTenantRepository(input.organizationId, {
    userId,
    name: input.templateRepositoryName,
    private: false,
    isTemplate: true,
  });
  await saveTenantNpmRepository({
    organizationId: input.organizationId,
    owner,
    npmRepositoryName: input.npmRepositoryName,
    workflowTemplateRepositoryName: input.templateRepositoryName,
    npmRepositoryId: npmRepository.id,
    npmRepositoryFullName: npmRepository.fullName,
    workflowTemplateRepositoryId: templateRepository.id,
    workflowTemplateRepositoryFullName: templateRepository.fullName,
  });
  await registerRepository({
    repositoryId: npmRepository.id,
    remote: repositoryRemote(npmRepository.fullName),
    isPrivate: false,
  });
  await registerRepository({
    repositoryId: templateRepository.id,
    remote: repositoryRemote(templateRepository.fullName),
    isPrivate: false,
  });
  return {
    npmRepositoryFullName: npmRepository.fullName,
    templateRepositoryFullName: templateRepository.fullName,
  };
}

const CI_WORKFLOW = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm run --if-present build
      - run: pnpm run --if-present test
`;

interface PackageManifest {
  versionNaming?: { pattern?: string };
}

async function githubGet(token: string, path: string): Promise<Response> {
  return fetch(`https://api.github.com/repos/${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
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
}): Promise<{ versionNaming: string }> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(input.organizationId, userId);
  if (!overview.installation) throw new Error('github_app_not_installed');
  const npmRepository = await getTenantNpmRepository(input.organizationId);
  if (!npmRepository?.npmRepositoryFullName || npmRepository.npmRepositoryId === null) {
    throw new Error('npm_not_configured');
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
  const setupBranch = 'chore/package-setup';
  const fileChanges: { path: string; content: string }[] = [];
  if (needsDeclaration) {
    fileChanges.push({
      path: 'package.json',
      content: `${JSON.stringify({ ...rawManifest, versionNaming: { pattern } }, null, 2)}\n`,
    });
  }
  if (!(await repositoryFileExists(token.token, input.repositoryFullName, '.github/workflows/ci.yml'))) {
    fileChanges.push({ path: '.github/workflows/ci.yml', content: CI_WORKFLOW });
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
  const addBranch = `feat/add-${repositoryName}-package`;
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
  if (addResult.outcome !== 'pushed') {
    throw new Error(`npm_repository_update_${addResult.outcome}`);
  }
  await createBotPullRequest({
    organizationId: input.organizationId,
    repositoryFullName: npmFullName,
    title: `Add ${repositoryName} as a package`,
    head: addBranch,
    base: 'main',
    enableAutoMerge: true,
  });

  await linkTenantPackage(input.organizationId, {
    userId,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    submodulePath,
    versionNaming: pattern,
  });
  return { versionNaming: pattern };
}

export async function setPackageEnabledAction(input: {
  organizationId: string;
  packageId: string;
  enabled: boolean;
}): Promise<void> {
  const userId = await requireUserId();
  await setTenantPackageEnabled(input.organizationId, input.packageId, { userId, enabled: input.enabled });
}

export interface DashboardData {
  signedIn: boolean;
  tenants: TenantSummary[];
  selected: TenantSummary | null;
  overview: TenantOverview | null;
  npmRepository: TenantNpmRepository | null;
  repositories: InstallationRepository[];
}

export async function getDashboardDataAction(tenantId?: string): Promise<DashboardData> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) {
    return { signedIn: false, tenants: [], selected: null, overview: null, npmRepository: null, repositories: [] };
  }
  const tenants = await listUserTenants(user.uid);
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) {
    return { signedIn: true, tenants, selected: null, overview: null, npmRepository: null, repositories: [] };
  }
  const [overview, npmRepository] = await Promise.all([
    getTenantOverview(selected.id, user.uid),
    getTenantNpmRepository(selected.id),
  ]);
  const repositories = overview.installation ? await listTenantRepositories(selected.id) : [];
  return { signedIn: true, tenants, selected, overview, npmRepository, repositories };
}

export interface NpmSetupData {
  signedIn: boolean;
  selected: TenantSummary | null;
  overview: TenantOverview | null;
  npmRepository: TenantNpmRepository | null;
}

export async function getNpmSetupDataAction(tenantId?: string): Promise<NpmSetupData> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) {
    return { signedIn: false, selected: null, overview: null, npmRepository: null };
  }
  const tenants = await listUserTenants(user.uid);
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) {
    return { signedIn: true, selected: null, overview: null, npmRepository: null };
  }
  const [overview, npmRepository] = await Promise.all([
    getTenantOverview(selected.id, user.uid),
    getTenantNpmRepository(selected.id),
  ]);
  return { signedIn: true, selected, overview, npmRepository };
}

export interface TenantSettingsData {
  overview: TenantOverview;
  npmRepository: TenantNpmRepository | null;
}

export async function getTenantSettingsDataAction(organizationId: string): Promise<TenantSettingsData> {
  const userId = await requireUserId();
  const [overview, npmRepository] = await Promise.all([
    getTenantOverview(organizationId, userId),
    getTenantNpmRepository(organizationId),
  ]);
  return { overview, npmRepository };
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
