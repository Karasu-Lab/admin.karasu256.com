'use server';

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSessionUser } from '@karasu-lab/utils/server';
import { DEFAULT_VERSION_NAMING_PATTERN } from '@karasu-lab/types/shared';
import {
  createBotPullRequest,
  createTenantRepository,
  getInstallationToken,
  getTenantOverview,
  getUserSigningKeyMaterial,
  linkTenantPackage,
  recordNpmConfiguration,
  setTenantPackageEnabled,
} from '@/lib/api-auth';
import { commitAll, configureCommitter, createBranch, git, pushBranch, withClonedRepository } from '@/lib/git-automation';

async function requireUserId(): Promise<string> {
  const user = await getSessionUser(process.env.NEXT_PUBLIC_AUTH_API_URL);
  if (!user) throw new Error('Unauthorized');
  return user.uid;
}

async function requireSigningMaterial(userId: string): Promise<{
  identity: { name: string; email: string };
  privateKey: string;
}> {
  const material = await getUserSigningKeyMaterial(userId);
  return {
    identity: { name: material.committerName, email: material.committerEmail },
    privateKey: material.privateKey,
  };
}

export async function startNpmSetupAction(input: {
  organizationId: string;
  npmRepositoryName: string;
  templateRepositoryName: string;
}): Promise<{ npmRepositoryFullName: string; templateRepositoryFullName: string }> {
  const userId = await requireUserId();
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
  await recordNpmConfiguration(input.organizationId, {
    userId,
    npmRepositoryId: npmRepository.id,
    npmRepositoryFullName: npmRepository.fullName,
    workflowTemplateRepositoryId: templateRepository.id,
    workflowTemplateRepositoryFullName: templateRepository.fullName,
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

async function readManifest(token: string, repositoryFullName: string): Promise<PackageManifest | null> {
  const response = await fetch(`https://api.github.com/repos/${repositoryFullName}/contents/package.json`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { content?: string };
  if (!data.content) return null;
  try {
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) as PackageManifest;
  } catch {
    return null;
  }
}

export async function linkPackageAction(input: {
  organizationId: string;
  repositoryId: number;
  repositoryFullName: string;
  defaultBranch: string;
}): Promise<{ versionNaming: string }> {
  const userId = await requireUserId();
  const overview = await getTenantOverview(input.organizationId, userId);
  if (!overview.installation) throw new Error('github_app_not_installed');
  if (!overview.npmConfiguration) throw new Error('npm_not_configured');
  const signerUserId = overview.installation.installedByUserId;
  if (!signerUserId) throw new Error('signing_user_unknown');
  const signer = await requireSigningMaterial(signerUserId);
  const token = await getInstallationToken(input.organizationId);
  const manifest = await readManifest(token.token, input.repositoryFullName);
  if (!manifest) throw new Error('package_json_not_found');
  let pattern = manifest.versionNaming?.pattern ?? null;
  const needsDeclaration = !pattern;
  if (!pattern) pattern = DEFAULT_VERSION_NAMING_PATTERN;

  const repositoryName = input.repositoryFullName.split('/')[1] ?? input.repositoryFullName;
  const setupBranch = 'chore/package-setup';
  const changed = await withClonedRepository(input.repositoryFullName, token.token, async (dir) => {
    let dirty = false;
    if (needsDeclaration) {
      const manifestPath = join(dir, 'package.json');
      const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
      raw.versionNaming = { pattern };
      await writeFile(manifestPath, `${JSON.stringify(raw, null, 2)}\n`);
      dirty = true;
    }
    const ciPath = join(dir, '.github', 'workflows', 'ci.yml');
    if (!existsSync(ciPath)) {
      await mkdir(join(dir, '.github', 'workflows'), { recursive: true });
      await writeFile(ciPath, CI_WORKFLOW);
      dirty = true;
    }
    if (!dirty) return false;
    await createBranch(dir, setupBranch);
    const cleanupKey = await configureCommitter(dir, signer.identity, signer.privateKey);
    try {
      await commitAll(dir, 'chore: set up CI and the version naming scheme');
    } finally {
      await cleanupKey();
    }
    await pushBranch(dir, setupBranch);
    return true;
  });
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

  const npmFullName = overview.npmConfiguration.npmRepositoryFullName;
  const addBranch = `feat/add-${repositoryName}-package`;
  await withClonedRepository(npmFullName, token.token, async (dir) => {
    await createBranch(dir, addBranch);
    await git(dir, [
      'submodule',
      'add',
      `https://x-access-token:${token.token}@github.com/${input.repositoryFullName}.git`,
      `packages/${repositoryName}`,
    ]);
    await git(dir, [
      'config',
      '-f',
      '.gitmodules',
      `submodule.packages/${repositoryName}.url`,
      `https://github.com/${input.repositoryFullName}.git`,
    ]);
    const cleanupKey = await configureCommitter(dir, signer.identity, signer.privateKey);
    try {
      await commitAll(dir, `feat: add ${input.repositoryFullName} as a package`);
    } finally {
      await cleanupKey();
    }
    await pushBranch(dir, addBranch);
  });
  const npmDefaultBranch = 'main';
  await createBotPullRequest({
    organizationId: input.organizationId,
    repositoryFullName: npmFullName,
    title: `Add ${repositoryName} as a package`,
    head: addBranch,
    base: npmDefaultBranch,
    enableAutoMerge: true,
  });

  await linkTenantPackage(input.organizationId, {
    userId,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    submodulePath: `packages/${repositoryName}`,
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
