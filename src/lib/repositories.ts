import 'server-only';
import { queryAdminDb, runAdminDb } from './admin-db';

export interface RegisteredRepository {
  repositoryId: number;
  remote: string;
  isPrivate: boolean;
}

interface RepositoryRow {
  repository_id: number;
  remote: string;
  is_private: number;
}

export async function getRegisteredRepository(repositoryId: number): Promise<RegisteredRepository | null> {
  const rows = await queryAdminDb<RepositoryRow>(
    'SELECT repository_id, remote, is_private FROM repositories WHERE repository_id = ?',
    [repositoryId]
  );
  const row = rows[0];
  if (!row) return null;
  return { repositoryId: row.repository_id, remote: row.remote, isPrivate: row.is_private !== 0 };
}

export async function registerRepository(input: RegisteredRepository): Promise<void> {
  await runAdminDb('INSERT OR REPLACE INTO repositories (repository_id, remote, is_private) VALUES (?, ?, ?)', [
    input.repositoryId,
    input.remote,
    input.isPrivate ? 1 : 0,
  ]);
}

export async function unregisterRepository(repositoryId: number): Promise<void> {
  await runAdminDb('DELETE FROM repositories WHERE repository_id = ?', [repositoryId]);
}

export function repositoryRemote(repositoryFullName: string): string {
  return `https://github.com/${repositoryFullName}.git`;
}
