import { SetupClient } from '@/components/setup-client';
import { getClientConfig } from '@/lib/client-config';

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const clientConfig = getClientConfig();
  return <SetupClient tenantId={params.tenant} authApiUrl={clientConfig.authApiUrl} appUrl={clientConfig.appUrl} />;
}
