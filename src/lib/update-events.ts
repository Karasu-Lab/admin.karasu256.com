import 'server-only';
import { queryAdminDb, runAdminDb } from './admin-db';

export type PackageUpdateStatus = 'processing' | 'completed' | 'failed';

export interface PackageUpdateEvent {
  id: string;
  organizationId: string;
  packageId: string;
  repositoryFullName: string;
  status: PackageUpdateStatus;
  fromSha: string | null;
  toSha: string;
  reason: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface LiveFeedData {
  processing: PackageUpdateEvent[];
  recent: PackageUpdateEvent[];
}

interface PackageUpdateEventRow {
  id: string;
  organization_id: string;
  package_id: string;
  repository_full_name: string;
  status: string;
  from_sha: string | null;
  to_sha: string;
  reason: string | null;
  started_at: string;
  finished_at: string | null;
}

function toPackageUpdateEvent(row: PackageUpdateEventRow): PackageUpdateEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    packageId: row.package_id,
    repositoryFullName: row.repository_full_name,
    status: row.status === 'completed' || row.status === 'failed' ? row.status : 'processing',
    fromSha: row.from_sha,
    toSha: row.to_sha,
    reason: row.reason,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export async function startPackageUpdate(input: {
  organizationId: string;
  packageId: string;
  repositoryFullName: string;
  fromSha: string | null;
  toSha: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await runAdminDb(
    'INSERT INTO package_update_events (id, organization_id, package_id, repository_full_name, status, from_sha, to_sha, reason, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.organizationId, input.packageId, input.repositoryFullName, 'processing', input.fromSha, input.toSha, null, new Date().toISOString(), null]
  );
  return id;
}

export async function finishPackageUpdate(
  id: string,
  organizationId: string,
  status: Exclude<PackageUpdateStatus, 'processing'>,
  reason?: string
): Promise<void> {
  await runAdminDb('UPDATE package_update_events SET status = ?, reason = ?, finished_at = ? WHERE id = ?', [
    status,
    reason ?? null,
    new Date().toISOString(),
    id,
  ]);
  await runAdminDb(
    `DELETE FROM package_update_events
     WHERE organization_id = ? AND status != 'processing' AND id NOT IN (
       SELECT id FROM package_update_events WHERE organization_id = ? AND status != 'processing' ORDER BY finished_at DESC LIMIT 50
     )`,
    [organizationId, organizationId]
  );
}

export async function getLiveFeed(organizationId: string): Promise<LiveFeedData> {
  const processingRows = await queryAdminDb<PackageUpdateEventRow>(
    `SELECT id, organization_id, package_id, repository_full_name, status, from_sha, to_sha, reason, started_at, finished_at
     FROM package_update_events WHERE organization_id = ? AND status = 'processing' ORDER BY started_at DESC`,
    [organizationId]
  );
  const recentRows = await queryAdminDb<PackageUpdateEventRow>(
    `SELECT id, organization_id, package_id, repository_full_name, status, from_sha, to_sha, reason, started_at, finished_at
     FROM package_update_events WHERE organization_id = ? AND status != 'processing' ORDER BY finished_at DESC LIMIT 10`,
    [organizationId]
  );
  return {
    processing: processingRows.map(toPackageUpdateEvent),
    recent: recentRows.map(toPackageUpdateEvent),
  };
}
