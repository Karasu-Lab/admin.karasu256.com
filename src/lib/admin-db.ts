import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getAdminDb(): Promise<D1Database> {
  let env: CloudflareEnv;
  try {
    env = (await getCloudflareContext({ async: true })).env;
  } catch (error) {
    throw new Error(
      `The Cloudflare context is not available, so the ADMIN_DB D1 binding could not be resolved: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!env.ADMIN_DB) {
    throw new Error('The ADMIN_DB D1 binding is not configured for this worker');
  }
  return env.ADMIN_DB;
}

export async function queryAdminDb<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getAdminDb();
  const result = await db.prepare(sql).bind(...params).all<T>();
  if (!result.success) {
    throw new Error(`D1 query failed: ${result.error ?? 'unknown error'} (SQL: ${sql})`);
  }
  return result.results;
}

export async function runAdminDb(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getAdminDb();
  const result = await db.prepare(sql).bind(...params).run();
  if (!result.success) {
    throw new Error(`D1 query failed: ${result.error ?? 'unknown error'} (SQL: ${sql})`);
  }
}
