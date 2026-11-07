import { PackagesClient } from '@/components/packages-client';

export default async function PackagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = (await searchParams) ?? {};
  return <PackagesClient tenantId={params.tenant} />;
}
