import 'server-only';
import { z } from 'zod';
import { getClientConfig } from './client-config';
import { commitContents, createBotPullRequest, createTenantRepository, listTenantRepositories } from './git-api';
import { GithubIdentifiers } from './github-identifiers';
import { deleteTenantNpmRepository, getTenantNpmRepository, saveTenantNpmRepository } from './npm-repository';
import { TemplateFiles, type SetupFile } from './template-files';
import { TenantAccess } from './tenant-access';
import type { InstallationRepository } from './tenants';

export function repositorySetupOutcomeSchema() {
  return z.enum(['created', 'overwritten']);
}

export type RepositorySetupOutcome = z.infer<ReturnType<typeof repositorySetupOutcomeSchema>>;

export function npmRepositorySetupResultSchema() {
  return z.object({ npmRepositoryFullName: z.string(), outcome: repositorySetupOutcomeSchema() });
}

export type NpmRepositorySetupResult = z.infer<ReturnType<typeof npmRepositorySetupResultSchema>>;

export function templateRepositorySetupResultSchema() {
  return z.object({ templateRepositoryFullName: z.string(), outcome: repositorySetupOutcomeSchema() });
}

export type TemplateRepositorySetupResult = z.infer<ReturnType<typeof templateRepositorySetupResultSchema>>;

export function setupTargetSchema() {
  return z.object({
    owner: z.string(),
    targetType: z.enum(['Organization', 'User']),
  });
}

export type SetupTarget = z.infer<ReturnType<typeof setupTargetSchema>>;

export class RepositorySetup {
  defaultNpmRepositoryName = 'npm';
  defaultTemplateRepositoryName = 'workflow-templates';
  fallbackBaseBranch = 'main';
  organizationTargetType = 'organization';
  npmSetup = {
    branch: 'chore/set-up-release-flow',
    message: 'chore: set up the release flow',
    pullRequestTitle: 'Set up the release flow',
  };
  templateSetup = {
    branch: 'chore/set-up-shared-ci-workflow',
    message: 'chore: set up the shared CI workflow',
    pullRequestTitle: 'Set up the shared CI workflow',
  };
  access = new TenantAccess();
  identifiers = new GithubIdentifiers();
  templates = new TemplateFiles();
  outcomes = repositorySetupOutcomeSchema().enum;

  private async resolveTarget(organizationId: string): Promise<SetupTarget> {
    const { overview } = await this.access.requireSetupRole(organizationId);
    if (!overview.installation) throw new Error('github_app_not_installed');
    return {
      owner: overview.installation.targetLogin,
      targetType: overview.installation.targetType === this.organizationTargetType ? 'Organization' : 'User',
    };
  }

  private findExisting(repositories: InstallationRepository[], owner: string, name: string): InstallationRepository | null {
    const fullName = `${owner}/${name}`.toLowerCase();
    return repositories.find((repository) => repository.fullName.toLowerCase() === fullName) ?? null;
  }

  private requireReusable(repository: InstallationRepository): InstallationRepository {
    if (repository.private) {
      throw new Error(
        `Repository ${repository.fullName} already exists and is private, so it cannot be used for the npm setup, which requires a public repository`
      );
    }
    return repository;
  }

  private async createOrReuse(input: {
    organizationId: string;
    target: SetupTarget;
    name: string;
    isTemplate?: boolean;
  }): Promise<{ repository: InstallationRepository; outcome: RepositorySetupOutcome }> {
    const known = await listTenantRepositories(input.organizationId);
    const existing = this.findExisting(known, input.target.owner, input.name);
    if (existing) return { repository: this.requireReusable(existing), outcome: this.outcomes.overwritten };
    try {
      const repository = await createTenantRepository({
        organizationId: input.organizationId,
        targetType: input.target.targetType,
        targetLogin: input.target.owner,
        name: input.name,
        private: false,
        isTemplate: input.isTemplate,
      });
      return { repository, outcome: this.outcomes.created };
    } catch (caught) {
      const refreshed = await listTenantRepositories(input.organizationId).catch(() => []);
      const appeared = this.findExisting(refreshed, input.target.owner, input.name);
      if (appeared) return { repository: this.requireReusable(appeared), outcome: this.outcomes.overwritten };
      throw caught;
    }
  }

  private async seed(input: {
    organizationId: string;
    repository: InstallationRepository;
    setup: { branch: string; message: string; pullRequestTitle: string };
    files: SetupFile[];
  }): Promise<void> {
    const baseBranch = input.repository.defaultBranch || this.fallbackBaseBranch;
    const branch = `${input.setup.branch}-${crypto.randomUUID()}`;
    const result = await commitContents({
      organizationId: input.organizationId,
      repositoryFullName: input.repository.fullName,
      branch,
      baseBranch,
      message: input.setup.message,
      files: input.files,
    });
    if (result.outcome !== 'pushed') return;
    await createBotPullRequest({
      organizationId: input.organizationId,
      repositoryFullName: input.repository.fullName,
      title: input.setup.pullRequestTitle,
      head: branch,
      base: baseBranch,
      enableAutoMerge: true,
    });
  }

  async startNpm(organizationId: string, npmRepositoryName: string): Promise<NpmRepositorySetupResult> {
    this.identifiers.assertRepositoryName(npmRepositoryName);
    const target = await this.resolveTarget(organizationId);
    const existing = await getTenantNpmRepository(organizationId);
    const workflowTemplateRepositoryName = existing?.workflowTemplateRepositoryName ?? this.defaultTemplateRepositoryName;
    await saveTenantNpmRepository({ organizationId, owner: target.owner, npmRepositoryName, workflowTemplateRepositoryName });
    const setup = await this.createOrReuse({ organizationId, target, name: npmRepositoryName });
    await saveTenantNpmRepository({
      organizationId,
      owner: target.owner,
      npmRepositoryName,
      workflowTemplateRepositoryName,
      npmRepositoryId: setup.repository.id,
      npmRepositoryFullName: setup.repository.fullName,
    });
    const files = await this.templates.load('npm-repository', { ORIGIN: new URL(getClientConfig().appUrl).origin });
    await this.seed({ organizationId, repository: setup.repository, setup: this.npmSetup, files });
    return { npmRepositoryFullName: setup.repository.fullName, outcome: setup.outcome };
  }

  async startTemplate(organizationId: string, templateRepositoryName: string): Promise<TemplateRepositorySetupResult> {
    this.identifiers.assertRepositoryName(templateRepositoryName);
    const target = await this.resolveTarget(organizationId);
    const existing = await getTenantNpmRepository(organizationId);
    const npmRepositoryName = existing?.npmRepositoryName ?? this.defaultNpmRepositoryName;
    await saveTenantNpmRepository({
      organizationId,
      owner: target.owner,
      npmRepositoryName,
      workflowTemplateRepositoryName: templateRepositoryName,
    });
    const setup = await this.createOrReuse({ organizationId, target, name: templateRepositoryName, isTemplate: true });
    await saveTenantNpmRepository({
      organizationId,
      owner: target.owner,
      npmRepositoryName,
      workflowTemplateRepositoryName: templateRepositoryName,
      workflowTemplateRepositoryId: setup.repository.id,
      workflowTemplateRepositoryFullName: setup.repository.fullName,
    });
    const files = await this.templates.load('workflow-templates', { TEMPLATE_REPOSITORY: setup.repository.fullName });
    await this.seed({ organizationId, repository: setup.repository, setup: this.templateSetup, files });
    return { templateRepositoryFullName: setup.repository.fullName, outcome: setup.outcome };
  }

  async unlinkNpm(organizationId: string): Promise<void> {
    await this.access.requireSetupRole(organizationId);
    await deleteTenantNpmRepository(organizationId);
  }
}
