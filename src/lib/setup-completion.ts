import 'server-only';
import { queryAdminDb, runAdminDb } from './admin-db';

export async function getTenantSetupCompleted(organizationId: string): Promise<boolean> {
  const rows = await queryAdminDb<{ organization_id: string }>(
    'SELECT organization_id FROM tenant_setup_completion WHERE organization_id = ?',
    [organizationId]
  );
  return rows.length > 0;
}

export async function markTenantSetupCompleted(organizationId: string): Promise<void> {
  await runAdminDb(
    'INSERT INTO tenant_setup_completion (organization_id, completed_at) VALUES (?, ?) ON CONFLICT(organization_id) DO NOTHING',
    [organizationId, new Date().toISOString()]
  );
}
