import 'server-only';
import { queryAdminDb, runAdminDb } from './admin-db';

export interface TenantNpmRepository {
  organizationId: string;
  owner: string;
  npmRepositoryName: string;
  workflowTemplateRepositoryName: string;
  npmRepositoryId: number | null;
  npmRepositoryFullName: string | null;
  workflowTemplateRepositoryId: number | null;
  workflowTemplateRepositoryFullName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTenantNpmRepositoryInput {
  organizationId: string;
  owner: string;
  npmRepositoryName: string;
  workflowTemplateRepositoryName: string;
  npmRepositoryId?: number | null;
  npmRepositoryFullName?: string | null;
  workflowTemplateRepositoryId?: number | null;
  workflowTemplateRepositoryFullName?: string | null;
}

interface TenantNpmRepositoryRow {
  organization_id: string;
  owner: string;
  npm_repository_name: string;
  workflow_template_repository_name: string;
  npm_repository_id: number | null;
  npm_repository_full_name: string | null;
  workflow_template_repository_id: number | null;
  workflow_template_repository_full_name: string | null;
  created_at: string;
  updated_at: string;
}

function toTenantNpmRepository(row: TenantNpmRepositoryRow): TenantNpmRepository {
  return {
    organizationId: row.organization_id,
    owner: row.owner,
    npmRepositoryName: row.npm_repository_name,
    workflowTemplateRepositoryName: row.workflow_template_repository_name,
    npmRepositoryId: row.npm_repository_id,
    npmRepositoryFullName: row.npm_repository_full_name,
    workflowTemplateRepositoryId: row.workflow_template_repository_id,
    workflowTemplateRepositoryFullName: row.workflow_template_repository_full_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTenantNpmRepository(organizationId: string): Promise<TenantNpmRepository | null> {
  const rows = await queryAdminDb<TenantNpmRepositoryRow>(
    'SELECT organization_id, owner, npm_repository_name, workflow_template_repository_name, npm_repository_id, npm_repository_full_name, workflow_template_repository_id, workflow_template_repository_full_name, created_at, updated_at FROM tenant_npm_repository WHERE organization_id = ?',
    [organizationId]
  );
  return rows[0] ? toTenantNpmRepository(rows[0]) : null;
}

export async function getTenantNpmRepositoryByFullName(npmRepositoryFullName: string): Promise<TenantNpmRepository | null> {
  const rows = await queryAdminDb<TenantNpmRepositoryRow>(
    'SELECT organization_id, owner, npm_repository_name, workflow_template_repository_name, npm_repository_id, npm_repository_full_name, workflow_template_repository_id, workflow_template_repository_full_name, created_at, updated_at FROM tenant_npm_repository WHERE npm_repository_full_name = ?',
    [npmRepositoryFullName]
  );
  return rows[0] ? toTenantNpmRepository(rows[0]) : null;
}

export async function deleteTenantNpmRepository(organizationId: string): Promise<void> {
  await runAdminDb('DELETE FROM tenant_npm_repository WHERE organization_id = ?', [organizationId]);
}

export async function saveTenantNpmRepository(input: SaveTenantNpmRepositoryInput): Promise<void> {
  const now = new Date().toISOString();
  await runAdminDb(
    `INSERT INTO tenant_npm_repository (
      organization_id, owner, npm_repository_name, workflow_template_repository_name,
      npm_repository_id, npm_repository_full_name,
      workflow_template_repository_id, workflow_template_repository_full_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET
      owner = excluded.owner,
      npm_repository_name = excluded.npm_repository_name,
      workflow_template_repository_name = excluded.workflow_template_repository_name,
      npm_repository_id = COALESCE(excluded.npm_repository_id, tenant_npm_repository.npm_repository_id),
      npm_repository_full_name = COALESCE(excluded.npm_repository_full_name, tenant_npm_repository.npm_repository_full_name),
      workflow_template_repository_id = COALESCE(excluded.workflow_template_repository_id, tenant_npm_repository.workflow_template_repository_id),
      workflow_template_repository_full_name = COALESCE(excluded.workflow_template_repository_full_name, tenant_npm_repository.workflow_template_repository_full_name),
      updated_at = excluded.updated_at`,
    [
      input.organizationId,
      input.owner,
      input.npmRepositoryName,
      input.workflowTemplateRepositoryName,
      input.npmRepositoryId ?? null,
      input.npmRepositoryFullName ?? null,
      input.workflowTemplateRepositoryId ?? null,
      input.workflowTemplateRepositoryFullName ?? null,
      now,
      now,
    ]
  );
}
