import { DashboardClient } from '@/components/dashboard-client';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  return <DashboardClient tenantId={params.tenant} />;
}
