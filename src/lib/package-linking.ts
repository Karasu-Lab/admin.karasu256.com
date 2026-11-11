import 'server-only';
import { z } from 'zod';
import { DEFAULT_VERSION_NAMING_PATTERN } from '@karasu-lab/types/shared';
import { log } from '@karasu-lab/utils/server';
import { getInstallationToken, getTenantOverview, linkTenantPackage, unlinkTenantPackage } from './api-auth';
import {
  commitContents,
  createBotPullRequest,
  dispatchRepositoryEvent,
  listTenantRepositories,
} from './git-api';
import { GithubContents } from './github-contents';
import { GithubIdentifiers } from './github-identifiers';
import { getTenantNpmRepository, type TenantNpmRepository } from './npm-repository';
import { syncEventSchema } from './sync-events';
import { TemplateFiles, type SetupFile } from './template-files';
import { TenantAccess } from './tenant-access';
import { tenantLinkedPackageSchema, type TenantOverview } from './tenants';

export function packageManifestSchema() {
  return z.looseObject({
    versionNaming: z.object({ pattern: z.string().optional().catch(undefined) }).optional().catch(undefined),
  });
}

export type PackageManifest = z.infer<ReturnType<typeof packageManifestSchema>>;

export function linkPackageResultSchema() {
  return z.object({ versionNaming: z.string(), linkedPackages: z.array(tenantLinkedPackageSchema()) });
}

export type LinkPackageResult = z.infer<ReturnType<typeof linkPackageResultSchema>>;

export class PackageLinking {
  setupBranchBase = 'chore/package-setup';
  setupMessage = 'chore: set up CI and the version naming scheme';
  setupPullRequestTitle = 'Set up CI and the version naming scheme';
  manifestPath = 'package.json';
  ciWorkflowPath = '.github/workflows/ci.yml';
  packagesDirectory = 'packages/';
  jsonIndent = 2;
  access = new TenantAccess();
  contents = new GithubContents();
  identifiers = new GithubIdentifiers();
  templates = new TemplateFiles();
  events = syncEventSchema().enum;

  private async requireMirrorRepository(organizationId: string): Promise<TenantNpmRepository & { npmRepositoryFullName: string }> {
    const npmRepository = await getTenantNpmRepository(organizationId);
    if (!npmRepository?.npmRepositoryFullName) throw new Error('npm_not_configured');
    return { ...npmRepository, npmRepositoryFullName: npmRepository.npmRepositoryFullName };
  }

  private async packageSetupFiles(input: {
    token: string;
    repositoryFullName: string;
    manifest: PackageManifest;
    pattern: string;
    templateRepositoryFullName: string;
  }): Promise<SetupFile[]> {
    const files: SetupFile[] = [];
    if (!input.manifest.versionNaming?.pattern) {
      files.push({
        path: this.manifestPath,
        content: `${JSON.stringify({ ...input.manifest, versionNaming: { pattern: input.pattern } }, null, this.jsonIndent)}\n`,
      });
    }
    if (!(await this.contents.exists(input.token, input.repositoryFullName, this.ciWorkflowPath))) {
      const [ciWorkflow] = await this.templates.load('package', { TEMPLATE_REPOSITORY: input.templateRepositoryFullName });
      files.push(ciWorkflow);
    }
    return files;
  }

  async link(organizationId: string, repositoryId: number): Promise<LinkPackageResult> {
    const { userId, overview } = await this.access.requireSetupRole(organizationId);
    if (!overview.installation) throw new Error('github_app_not_installed');
    const npmRepository = await this.requireMirrorRepository(organizationId);
    if (npmRepository.npmRepositoryId === null || !npmRepository.workflowTemplateRepositoryFullName) {
      throw new Error('npm_not_configured');
    }
    const repositories = await listTenantRepositories(organizationId);
    const repository = repositories.find((candidate) => candidate.id === repositoryId);
    if (!repository) throw new Error('repository_not_in_installation');
    if (repository.private) {
      throw new Error(`Repository ${repository.fullName} is private and cannot be linked`);
    }
    if (
      repository.fullName === npmRepository.npmRepositoryFullName ||
      repository.fullName === npmRepository.workflowTemplateRepositoryFullName
    ) {
      throw new Error('setup_repository_cannot_be_linked');
    }
    this.identifiers.assertRepositoryFullName(repository.fullName);
    this.identifiers.assertBranchName(repository.defaultBranch);

    const { token } = await getInstallationToken(organizationId);
    const parsedManifest = packageManifestSchema().safeParse(
      await this.contents.readJson(token, repository.fullName, this.manifestPath)
    );
    if (!parsedManifest.success) throw new Error('package_json_not_found');
    const pattern = parsedManifest.data.versionNaming?.pattern || DEFAULT_VERSION_NAMING_PATTERN;

    const files = await this.packageSetupFiles({
      token,
      repositoryFullName: repository.fullName,
      manifest: parsedManifest.data,
      pattern,
      templateRepositoryFullName: npmRepository.workflowTemplateRepositoryFullName,
    });
    if (files.length > 0) {
      const branch = `${this.setupBranchBase}-${crypto.randomUUID()}`;
      const result = await commitContents({
        organizationId,
        repositoryFullName: repository.fullName,
        branch,
        baseBranch: repository.defaultBranch,
        message: this.setupMessage,
        files,
      });
      if (result.outcome === 'pushed') {
        await createBotPullRequest({
          organizationId,
          repositoryFullName: repository.fullName,
          title: this.setupPullRequestTitle,
          head: branch,
          base: repository.defaultBranch,
          enableAutoMerge: true,
        });
      }
    }

    const sha = await this.contents.headOid(token, repository.fullName, repository.defaultBranch);
    await dispatchRepositoryEvent({
      organizationId,
      repositoryFullName: npmRepository.npmRepositoryFullName,
      eventType: this.events['link-package'],
      clientPayload: { repositoryFullName: repository.fullName, defaultBranch: repository.defaultBranch, sha },
    });
    await linkTenantPackage(organizationId, {
      userId,
      repositoryId: repository.id,
      repositoryFullName: repository.fullName,
      submodulePath: `${this.packagesDirectory}${repository.name}`,
      versionNaming: pattern,
    });
    const refreshed = await this.reconcile({
      organizationId,
      userId,
      overview: await getTenantOverview(organizationId, userId),
      npmRepository,
    });
    return { versionNaming: pattern, linkedPackages: refreshed.linkedPackages };
  }

  async unlink(organizationId: string, packageId: string): Promise<void> {
    const { userId, overview } = await this.access.requireSetupRole(organizationId);
    const linked = overview.linkedPackages.find((entry) => entry.id === packageId);
    if (!linked) throw new Error('linked_package_not_found');
    const npmRepository = await this.requireMirrorRepository(organizationId);
    await dispatchRepositoryEvent({
      organizationId,
      repositoryFullName: npmRepository.npmRepositoryFullName,
      eventType: this.events['unlink-package'],
      clientPayload: { path: linked.submodulePath },
    });
    await unlinkTenantPackage(organizationId, packageId, { userId });
  }

  async reconcile(input: {
    organizationId: string;
    userId: string;
    overview: TenantOverview;
    npmRepository: TenantNpmRepository | null;
  }): Promise<TenantOverview> {
    const { organizationId, userId, overview, npmRepository } = input;
    if (!overview.installation || !npmRepository?.npmRepositoryFullName) return overview;
    if (!this.access.hasSetupRole(overview.organization.role)) return overview;
    try {
      const repositories = await listTenantRepositories(organizationId);
      if (!repositories.some((repository) => repository.fullName === npmRepository.npmRepositoryFullName)) {
        log('linked_package_reconcile_skipped', { organizationId, reason: 'npm_repository_not_accessible' }, 'error');
        return overview;
      }
      const { token } = await getInstallationToken(organizationId);
      const submodules = await this.contents.readSubmodules(token, npmRepository.npmRepositoryFullName);
      const linkedNames = new Set(overview.linkedPackages.map((linked) => linked.repositoryFullName));
      const byFullName = new Map(repositories.map((repository) => [repository.fullName, repository]));
      let registered = false;
      for (const submodule of submodules.filter((entry) => !linkedNames.has(entry.repositoryFullName))) {
        const repository = byFullName.get(submodule.repositoryFullName);
        if (!repository || repository.private) continue;
        try {
          const manifest = packageManifestSchema().safeParse(
            await this.contents.readJson(token, repository.fullName, this.manifestPath)
          );
          await linkTenantPackage(organizationId, {
            userId,
            repositoryId: repository.id,
            repositoryFullName: repository.fullName,
            submodulePath: submodule.path,
            versionNaming: (manifest.success && manifest.data.versionNaming?.pattern) || DEFAULT_VERSION_NAMING_PATTERN,
          });
          registered = true;
        } catch (caught) {
          log(
            'linked_package_reconcile_failed',
            { organizationId, repositoryFullName: submodule.repositoryFullName, message: caught instanceof Error ? caught.message : String(caught) },
            'error'
          );
        }
      }
      return registered ? await getTenantOverview(organizationId, userId) : overview;
    } catch (caught) {
      log(
        'linked_package_reconcile_failed',
        { organizationId, message: caught instanceof Error ? caught.message : String(caught) },
        'error'
      );
      return overview;
    }
  }
}
