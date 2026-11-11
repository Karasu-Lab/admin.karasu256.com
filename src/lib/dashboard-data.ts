import 'server-only';
import { z } from 'zod';
import { getTenantOverview, listUserTenants } from './api-auth';
import { listTenantRepositories } from './git-api';
import { getTenantNpmRepository, tenantNpmRepositorySchema } from './npm-repository';
import { PackageLinking } from './package-linking';
import { getTenantSetupCompleted } from './setup-completion';
import { TenantAccess } from './tenant-access';
import {
  installationRepositorySchema,
  tenantOverviewSchema,
  tenantSummarySchema,
  type TenantSummary,
} from './tenants';
import { PackageUpdateEvents, liveFeedDataSchema, type LiveFeedData } from './update-events';
import { WebhookSecrets } from './webhook-secret';
import { log } from '@karasu-lab/utils/server';

export function dashboardDataSchema() {
  return z.object({
    signedIn: z.boolean(),
    tenants: z.array(tenantSummarySchema()),
    selected: tenantSummarySchema().nullable(),
    overview: tenantOverviewSchema().nullable(),
    npmRepository: tenantNpmRepositorySchema().nullable(),
    repositories: z.array(installationRepositorySchema()),
    setupCompleted: z.boolean(),
  });
}

export type DashboardData = z.infer<ReturnType<typeof dashboardDataSchema>>;

export function setupDataSchema() {
  return dashboardDataSchema().omit({ tenants: true, setupCompleted: true });
}

export type SetupData = z.infer<ReturnType<typeof setupDataSchema>>;

export function packagesDataSchema() {
  return z.object({
    signedIn: z.boolean(),
    selected: tenantSummarySchema().nullable(),
    overview: tenantOverviewSchema().nullable(),
    webhookSecret: z.string().nullable(),
  });
}

export type PackagesData = z.infer<ReturnType<typeof packagesDataSchema>>;

export function tenantSettingsDataSchema() {
  return z.object({ overview: tenantOverviewSchema(), npmRepository: tenantNpmRepositorySchema().nullable() });
}

export type TenantSettingsData = z.infer<ReturnType<typeof tenantSettingsDataSchema>>;

export function tenantProfileDataSchema() {
  return z.object({ name: z.string(), slug: z.string() });
}

export type TenantProfileData = z.infer<ReturnType<typeof tenantProfileDataSchema>>;

export function selectedTenantSchema() {
  return z.object({ userId: z.string(), tenants: z.array(tenantSummarySchema()), selected: tenantSummarySchema().nullable() });
}

export type SelectedTenant = z.infer<ReturnType<typeof selectedTenantSchema>>;

export class DashboardQueries {
  access = new TenantAccess();
  linking = new PackageLinking();
  updateEvents = new PackageUpdateEvents();
  webhookSecrets = new WebhookSecrets();

  private async selectTenant(tenantId?: string): Promise<SelectedTenant | null> {
    const userId = await this.access.optionalUserId();
    if (!userId) return null;
    const tenants = await listUserTenants(userId);
    const selected: TenantSummary | null = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
    return { userId, tenants, selected };
  }

  async dashboard(tenantId?: string): Promise<DashboardData> {
    const empty: DashboardData = {
      signedIn: false,
      tenants: [],
      selected: null,
      overview: null,
      npmRepository: null,
      repositories: [],
      setupCompleted: false,
    };
    const chosen = await this.selectTenant(tenantId);
    if (!chosen) return empty;
    if (!chosen.selected) return { ...empty, signedIn: true, tenants: chosen.tenants };
    const { selected, userId, tenants } = chosen;
    const [loadedOverview, npmRepository, setupCompleted] = await Promise.all([
      getTenantOverview(selected.id, userId),
      getTenantNpmRepository(selected.id),
      getTenantSetupCompleted(selected.id),
    ]);
    const overview = await this.linking.reconcile({ organizationId: selected.id, userId, overview: loadedOverview, npmRepository });
    const repositories = overview.installation ? await listTenantRepositories(selected.id) : [];
    return { signedIn: true, tenants, selected, overview, npmRepository, repositories, setupCompleted };
  }

  async setup(tenantId?: string): Promise<SetupData> {
    const empty: SetupData = { signedIn: false, selected: null, overview: null, npmRepository: null, repositories: [] };
    const chosen = await this.selectTenant(tenantId);
    if (!chosen) return empty;
    if (!chosen.selected) return { ...empty, signedIn: true };
    const { selected, userId } = chosen;
    const [overview, npmRepository] = await Promise.all([getTenantOverview(selected.id, userId), getTenantNpmRepository(selected.id)]);
    const repositories = overview.installation ? await listTenantRepositories(selected.id) : [];
    return { signedIn: true, selected, overview, npmRepository, repositories };
  }

  async tenantSettings(organizationId: string): Promise<TenantSettingsData> {
    const { userId, overview: loadedOverview } = await this.access.requireMember(organizationId);
    const npmRepository = await getTenantNpmRepository(organizationId);
    const overview = await this.linking.reconcile({ organizationId, userId, overview: loadedOverview, npmRepository });
    return { overview, npmRepository };
  }

  async packages(tenantId?: string): Promise<PackagesData> {
    const empty: PackagesData = { signedIn: false, selected: null, overview: null, webhookSecret: null };
    const chosen = await this.selectTenant(tenantId);
    if (!chosen) return empty;
    if (!chosen.selected) return { ...empty, signedIn: true };
    const { overview } = await this.tenantSettings(chosen.selected.id);
    const webhookSecret = this.access.hasSetupRole(overview.organization.role)
      ? await this.webhookSecrets.get(chosen.selected.id).catch((caught) => {
          log(
            'tenant_webhook_secret_load_failed',
            { organizationId: chosen.selected?.id, message: caught instanceof Error ? caught.message : String(caught) },
            'error'
          );
          return null;
        })
      : null;
    return { signedIn: true, selected: chosen.selected, overview, webhookSecret };
  }

  async profile(organizationId: string): Promise<TenantProfileData> {
    const { overview } = await this.access.requireMember(organizationId);
    return { name: overview.organization.name, slug: overview.organization.slug };
  }

  async liveFeed(organizationId: string): Promise<LiveFeedData> {
    await this.access.requireMember(organizationId);
    return liveFeedDataSchema().parse(await this.updateEvents.liveFeed(organizationId));
  }
}
