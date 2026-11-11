'use server';

import { setTenantPackageEnabled } from '@/lib/api-auth';
import { PackageLinking, type LinkPackageResult } from '@/lib/package-linking';
import { TenantAccess } from '@/lib/tenant-access';

export async function linkPackageAction(input: { organizationId: string; repositoryId: number }): Promise<LinkPackageResult> {
  return new PackageLinking().link(input.organizationId, input.repositoryId);
}

export async function unlinkPackageAction(input: { organizationId: string; packageId: string }): Promise<void> {
  await new PackageLinking().unlink(input.organizationId, input.packageId);
}

export async function setPackageEnabledAction(input: {
  organizationId: string;
  packageId: string;
  enabled: boolean;
}): Promise<void> {
  const { userId } = await new TenantAccess().requireSetupRole(input.organizationId);
  await setTenantPackageEnabled(input.organizationId, input.packageId, { userId, enabled: input.enabled });
}
