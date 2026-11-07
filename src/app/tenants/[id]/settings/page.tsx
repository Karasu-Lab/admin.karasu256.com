import { NavSidebar } from '@/components/nav-sidebar';
import { TenantSettingsClient } from '@/components/tenant-settings-client';
import { getClientConfig } from '@/lib/client-config';

export default async function TenantSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientConfig = getClientConfig();
  const authApiUrl = clientConfig.authApiUrl;
  const settingsUrl = `${clientConfig.appUrl}/tenants/${id}/settings`;
  const installUrl = `${authApiUrl}/api/github-app/install?organizationId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(settingsUrl)}`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavSidebar />
      <TenantSettingsClient tenantId={id} authApiUrl={authApiUrl} settingsUrl={settingsUrl} installUrl={installUrl} />
    </div>
  );
}
