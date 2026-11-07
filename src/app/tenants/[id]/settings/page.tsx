import { TenantProfileClient } from '@/components/tenant-profile-client';
import { getClientConfig } from '@/lib/client-config';

export default async function TenantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientConfig = getClientConfig();

  return <TenantProfileClient tenantId={id} authApiUrl={clientConfig.authApiUrl} />;
}
