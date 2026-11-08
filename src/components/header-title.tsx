'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spinner } from '@karasu-lab/ui';
import { useIsLoading } from './settings/loading-context';

export function HeaderTitle() {
  const pathname = usePathname();
  const tDashboard = useTranslations('Dashboard');
  const tSetup = useTranslations('Setup');
  const tPackages = useTranslations('Packages');
  const tTenantSettings = useTranslations('TenantSettings');
  const tTenantProfile = useTranslations('TenantProfile');
  const isLoading = useIsLoading();

  const title = pathname.startsWith('/tenants/')
    ? pathname.endsWith('/tenant-settings')
      ? tTenantSettings('title')
      : tTenantProfile('title')
    : pathname.startsWith('/setup')
      ? tSetup('title')
      : pathname.startsWith('/packages')
        ? tPackages('listTitle')
        : tDashboard('title');

  return (
    <span className="flex items-center gap-2">
      <span className="truncate">{title}</span>
      {isLoading && <Spinner className="size-4 shrink-0" />}
    </span>
  );
}
