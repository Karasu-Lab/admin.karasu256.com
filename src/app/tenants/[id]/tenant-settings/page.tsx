import { TenantSettingsClient } from '@/components/tenant-settings-client';
import { getClientConfig } from '@/lib/client-config';

export default async function TenantSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientConfig = getClientConfig();
  const authApiUrl = clientConfig.authApiUrl;
  const settingsUrl = `${clientConfig.appUrl}/tenants/${id}/tenant-settings`;
  const installUrl = `${authApiUrl}/api/github-app/install?organizationId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(settingsUrl)}`;

  return <TenantSettingsClient tenantId={id} authApiUrl={authApiUrl} settingsUrl={settingsUrl} installUrl={installUrl} />;
}
