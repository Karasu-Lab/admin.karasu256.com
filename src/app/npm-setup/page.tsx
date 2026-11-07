import { NpmSetupClient } from '@/components/npm-setup-client';

export default async function NpmSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  return <NpmSetupClient tenantId={params.tenant} />;
}
