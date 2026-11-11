import { log } from '@karasu-lab/utils/server';
import { DashboardClient } from '@/components/dashboard-client';
import { listUserTenants } from '@/lib/api-auth';
import { getTenantSetupCompleted } from '@/lib/setup-completion';
import { TenantAccess } from '@/lib/tenant-access';
import { PackageUpdateEvents, type LiveFeedData } from '@/lib/update-events';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  let initialSetupCompleted = false;
  let initialFeed: LiveFeedData | null = null;
  try {
    const userId = await new TenantAccess().optionalUserId();
    if (userId) {
      const tenants = await listUserTenants(userId);
      const selected = tenants.find((tenant) => tenant.id === params.tenant) ?? tenants[0] ?? null;
      if (selected) {
        initialSetupCompleted = await getTenantSetupCompleted(selected.id);
        initialFeed = await new PackageUpdateEvents().liveFeed(selected.id);
      }
    }
  } catch (error) {
    log('dashboard_initial_state_failed', { message: error instanceof Error ? error.message : String(error) }, 'error');
  }
  return <DashboardClient tenantId={params.tenant} initialSetupCompleted={initialSetupCompleted} initialFeed={initialFeed} />;
}
