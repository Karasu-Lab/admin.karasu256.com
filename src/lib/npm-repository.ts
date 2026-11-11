import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { tenantNpmRepository } from '@/db/schema';
import { getDb } from './admin-db';

export function tenantNpmRepositorySchema() {
  return z.object({
    organizationId: z.string(),
    owner: z.string(),
    npmRepositoryName: z.string(),
    workflowTemplateRepositoryName: z.string(),
    npmRepositoryId: z.number().nullable(),
    npmRepositoryFullName: z.string().nullable(),
    workflowTemplateRepositoryId: z.number().nullable(),
    workflowTemplateRepositoryFullName: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });
}

export type TenantNpmRepository = z.infer<ReturnType<typeof tenantNpmRepositorySchema>>;

export function saveTenantNpmRepositoryInputSchema() {
  return z.object({
    organizationId: z.string(),
    owner: z.string(),
    npmRepositoryName: z.string(),
    workflowTemplateRepositoryName: z.string(),
    npmRepositoryId: z.number().nullable().optional(),
    npmRepositoryFullName: z.string().nullable().optional(),
    workflowTemplateRepositoryId: z.number().nullable().optional(),
    workflowTemplateRepositoryFullName: z.string().nullable().optional(),
  });
}

export type SaveTenantNpmRepositoryInput = z.infer<ReturnType<typeof saveTenantNpmRepositoryInputSchema>>;

export async function getTenantNpmRepository(organizationId: string): Promise<TenantNpmRepository | null> {
  const db = await getDb();
  const rows = await db.select().from(tenantNpmRepository).where(eq(tenantNpmRepository.organizationId, organizationId)).limit(1);
  return rows[0] ?? null;
}

export async function getTenantNpmRepositoryByRepositoryId(npmRepositoryId: number): Promise<TenantNpmRepository | null> {
  const db = await getDb();
  const rows = await db.select().from(tenantNpmRepository).where(eq(tenantNpmRepository.npmRepositoryId, npmRepositoryId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteTenantNpmRepository(organizationId: string): Promise<void> {
  const db = await getDb();
  await db.delete(tenantNpmRepository).where(eq(tenantNpmRepository.organizationId, organizationId));
}

export async function saveTenantNpmRepository(input: SaveTenantNpmRepositoryInput): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDb();
  const optionalColumns = {
    ...(input.npmRepositoryId != null ? { npmRepositoryId: input.npmRepositoryId } : {}),
    ...(input.npmRepositoryFullName != null ? { npmRepositoryFullName: input.npmRepositoryFullName } : {}),
    ...(input.workflowTemplateRepositoryId != null ? { workflowTemplateRepositoryId: input.workflowTemplateRepositoryId } : {}),
    ...(input.workflowTemplateRepositoryFullName != null
      ? { workflowTemplateRepositoryFullName: input.workflowTemplateRepositoryFullName }
      : {}),
  };
  await db
    .insert(tenantNpmRepository)
    .values({
      organizationId: input.organizationId,
      owner: input.owner,
      npmRepositoryName: input.npmRepositoryName,
      workflowTemplateRepositoryName: input.workflowTemplateRepositoryName,
      ...optionalColumns,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tenantNpmRepository.organizationId,
      set: {
        owner: input.owner,
        npmRepositoryName: input.npmRepositoryName,
        workflowTemplateRepositoryName: input.workflowTemplateRepositoryName,
        ...optionalColumns,
        updatedAt: now,
      },
    });
}
