'use server';

import {
  RepositorySetup,
  type NpmRepositorySetupResult,
  type TemplateRepositorySetupResult,
} from '@/lib/repository-setup';

export async function startNpmRepositorySetupAction(input: {
  organizationId: string;
  npmRepositoryName: string;
}): Promise<NpmRepositorySetupResult> {
  return new RepositorySetup().startNpm(input.organizationId, input.npmRepositoryName);
}

export async function startTemplateRepositorySetupAction(input: {
  organizationId: string;
  templateRepositoryName: string;
}): Promise<TemplateRepositorySetupResult> {
  return new RepositorySetup().startTemplate(input.organizationId, input.templateRepositoryName);
}

export async function unlinkNpmSetupAction(organizationId: string): Promise<void> {
  await new RepositorySetup().unlinkNpm(organizationId);
}
