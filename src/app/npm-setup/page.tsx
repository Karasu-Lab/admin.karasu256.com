import { NavSidebar } from '@/components/nav-sidebar';
import { NpmSetupClient } from '@/components/npm-setup-client';

export default async function NpmSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavSidebar />
      <NpmSetupClient tenantId={params.tenant} />
    </div>
  );
}
