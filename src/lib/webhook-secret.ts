import 'server-only';
import { randomBytes } from 'node:crypto';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { MissingEnvError } from '@karasu-lab/utils/server';
import { queryAdminDb, runAdminDb } from './admin-db';

function encryptionKey(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new MissingEnvError('BETTER_AUTH_SECRET');
  return secret;
}

export function getMasterWebhookSecret(): string | null {
  return process.env.GH_APP_WEBHOOK_SECRET || null;
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('base64');
}

export async function getTenantWebhookSecret(organizationId: string): Promise<string | null> {
  const rows = await queryAdminDb<{ encrypted_secret: string }>(
    'SELECT encrypted_secret FROM tenant_webhook_secret WHERE organization_id = ?',
    [organizationId]
  );
  const encrypted = rows[0]?.encrypted_secret;
  if (!encrypted) return null;
  return symmetricDecrypt({ key: encryptionKey(), data: encrypted });
}

export async function listTenantWebhookSecrets(): Promise<{ organizationId: string; secret: string }[]> {
  const rows = await queryAdminDb<{ organization_id: string; encrypted_secret: string }>(
    'SELECT organization_id, encrypted_secret FROM tenant_webhook_secret'
  );
  if (rows.length === 0) return [];
  const key = encryptionKey();
  const secrets: { organizationId: string; secret: string }[] = [];
  for (const row of rows) {
    const secret = await symmetricDecrypt({ key, data: row.encrypted_secret }).catch(() => null);
    if (secret) secrets.push({ organizationId: row.organization_id, secret });
  }
  return secrets;
}

export async function setTenantWebhookSecret(organizationId: string, secret: string): Promise<void> {
  const encrypted = await symmetricEncrypt({ key: encryptionKey(), data: secret });
  await runAdminDb(
    'INSERT INTO tenant_webhook_secret (organization_id, encrypted_secret, updated_at) VALUES (?, ?, ?) ON CONFLICT(organization_id) DO UPDATE SET encrypted_secret = excluded.encrypted_secret, updated_at = excluded.updated_at',
    [organizationId, encrypted, new Date().toISOString()]
  );
}
