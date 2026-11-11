import { z } from 'zod';

export function tenantSummarySchema() {
  return z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    role: z.string(),
  });
}

export type TenantSummary = z.infer<ReturnType<typeof tenantSummarySchema>>;

export function tenantInstallationSchema() {
  return z.object({
    id: z.string(),
    installationId: z.number(),
    targetType: z.string(),
    targetId: z.number(),
    targetLogin: z.string(),
    suspended: z.boolean(),
    installedByUserId: z.string().nullable(),
  });
}

export type TenantInstallation = z.infer<ReturnType<typeof tenantInstallationSchema>>;

export function tenantLinkedPackageSchema() {
  return z.object({
    id: z.string(),
    repositoryId: z.number(),
    repositoryFullName: z.string(),
    submodulePath: z.string(),
    versionNaming: z.string(),
    enabled: z.boolean(),
    lastSyncedSha: z.string().nullable(),
  });
}

export type TenantLinkedPackage = z.infer<ReturnType<typeof tenantLinkedPackageSchema>>;

export function tenantOverviewSchema() {
  return z.object({
    organization: z.object({ id: z.string(), name: z.string(), slug: z.string(), role: z.string() }),
    installation: tenantInstallationSchema().nullable(),
    linkedPackages: z.array(tenantLinkedPackageSchema()),
  });
}

export type TenantOverview = z.infer<ReturnType<typeof tenantOverviewSchema>>;

export function installationRepositorySchema() {
  return z.object({
    id: z.number(),
    fullName: z.string(),
    name: z.string(),
    private: z.boolean(),
    htmlUrl: z.string(),
    defaultBranch: z.string(),
  });
}

export type InstallationRepository = z.infer<ReturnType<typeof installationRepositorySchema>>;
