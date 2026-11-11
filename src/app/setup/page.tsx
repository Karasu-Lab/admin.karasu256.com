import { SetupClient } from '@/components/setup-client';

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  return <SetupClient tenantId={params.tenant} />;
}
