import { NavSidebar } from '@/components/nav-sidebar';
import { DashboardClient } from '@/components/dashboard-client';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <NavSidebar />
      <DashboardClient tenantId={params.tenant} />
    </div>
  );
}
