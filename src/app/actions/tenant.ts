'use server';

import { getGithubAppInstallUrl, uninstallTenantBot } from '@/lib/api-auth';
import { markTenantSetupCompleted } from '@/lib/setup-completion';
import { TenantAccess } from '@/lib/tenant-access';
import { WebhookSecrets } from '@/lib/webhook-secret';

export async function getGithubAppInstallUrlAction(): Promise<string> {
  await new TenantAccess().requireUserId();
  return getGithubAppInstallUrl();
}

export async function uninstallBotAction(organizationId: string): Promise<void> {
  const { userId } = await new TenantAccess().requireSetupRole(organizationId);
  await uninstallTenantBot(organizationId, { userId });
}

export async function markSetupCompletedAction(organizationId: string): Promise<void> {
  await new TenantAccess().requireSetupRole(organizationId);
  await markTenantSetupCompleted(organizationId);
}

export async function rotateWebhookSecretAction(organizationId: string): Promise<string> {
  await new TenantAccess().requireSetupRole(organizationId);
  const secrets = new WebhookSecrets();
  const secret = secrets.generate();
  await secrets.set(organizationId, secret);
  return secret;
}
