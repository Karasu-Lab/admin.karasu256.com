import { getSessionUser } from '@karasu-lab/utils/server';
import { DashboardClient } from '@/components/dashboard-client';
import { listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getTenantSetupCompleted } from '@/lib/setup-completion';
import { getLiveFeed, type LiveFeedData } from '@/lib/update-events';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  let initialSetupCompleted = false;
  let initialFeed: LiveFeedData | null = null;
  try {
    const user = await getSessionUser(getClientConfig().authApiUrl);
    if (user) {
      const tenants = await listUserTenants(user.uid);
      const selected = tenants.find((tenant) => tenant.id === params.tenant) ?? tenants[0] ?? null;
      if (selected) {
        initialSetupCompleted = await getTenantSetupCompleted(selected.id);
        initialFeed = await getLiveFeed(selected.id);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? new Error(`failed to load the dashboard initial state: ${error.message}`) : error);
  }
  return <DashboardClient tenantId={params.tenant} initialSetupCompleted={initialSetupCompleted} initialFeed={initialFeed} />;
}
