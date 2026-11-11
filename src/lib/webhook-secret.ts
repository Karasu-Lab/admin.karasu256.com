import 'server-only';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { MissingEnvError, log } from '@karasu-lab/utils/server';
import { tenantWebhookSecret } from '@/db/schema';
import { getDb } from './admin-db';

export class WebhookSecrets {
  secretBytes = 32;
  secretEncoding: BufferEncoding = 'base64';

  private encryptionKey(): string {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new MissingEnvError('BETTER_AUTH_SECRET');
    return secret;
  }

  master(): string | null {
    return process.env.GH_APP_WEBHOOK_SECRET || null;
  }

  generate(): string {
    return randomBytes(this.secretBytes).toString(this.secretEncoding);
  }

  async get(organizationId: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db
      .select({ encryptedSecret: tenantWebhookSecret.encryptedSecret })
      .from(tenantWebhookSecret)
      .where(eq(tenantWebhookSecret.organizationId, organizationId))
      .limit(1);
    const encrypted = rows[0]?.encryptedSecret;
    if (!encrypted) return null;
    return symmetricDecrypt({ key: this.encryptionKey(), data: encrypted });
  }

  async listTenantSecrets(): Promise<{ organizationId: string; secret: string }[]> {
    const db = await getDb();
    const rows = await db
      .select({ organizationId: tenantWebhookSecret.organizationId, encryptedSecret: tenantWebhookSecret.encryptedSecret })
      .from(tenantWebhookSecret);
    if (rows.length === 0) return [];
    const key = this.encryptionKey();
    const secrets: { organizationId: string; secret: string }[] = [];
    for (const row of rows) {
      const secret = await symmetricDecrypt({ key, data: row.encryptedSecret }).catch((caught) => {
        log(
          'tenant_webhook_secret_decrypt_failed',
          { organizationId: row.organizationId, message: caught instanceof Error ? caught.message : String(caught) },
          'error'
        );
        return null;
      });
      if (secret) secrets.push({ organizationId: row.organizationId, secret });
    }
    return secrets;
  }

  async set(organizationId: string, secret: string): Promise<void> {
    const encryptedSecret = await symmetricEncrypt({ key: this.encryptionKey(), data: secret });
    const updatedAt = new Date().toISOString();
    const db = await getDb();
    await db
      .insert(tenantWebhookSecret)
      .values({ organizationId, encryptedSecret, updatedAt })
      .onConflictDoUpdate({ target: tenantWebhookSecret.organizationId, set: { encryptedSecret, updatedAt } });
  }
}
