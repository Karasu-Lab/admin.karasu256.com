import 'server-only';
import { eq } from 'drizzle-orm';
import { tenantSetupCompletion } from '@/db/schema';
import { getDb } from './admin-db';

export async function getTenantSetupCompleted(organizationId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ organizationId: tenantSetupCompletion.organizationId })
    .from(tenantSetupCompletion)
    .where(eq(tenantSetupCompletion.organizationId, organizationId))
    .limit(1);
  return rows.length > 0;
}

export async function markTenantSetupCompleted(organizationId: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(tenantSetupCompletion)
    .values({ organizationId, completedAt: new Date().toISOString() })
    .onConflictDoNothing();
}
