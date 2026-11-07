'use client';

import { useTranslations } from 'next-intl';
import { DropdownMenuItem, DropdownMenuSeparator } from '@karasu-lab/ui';
import type { TenantSummary } from '@/lib/tenants';

export function TenantMenuSection({
  tenants,
  onAddTenant,
}: {
  tenants: TenantSummary[];
  onAddTenant: () => void;
}) {
  const t = useTranslations('header');
  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2 py-1 text-xs text-muted-foreground">{t('tenants')}</div>
      {tenants.map((tenant) => (
        <DropdownMenuItem
          key={tenant.id}
          render={<a href={`/tenants/${tenant.id}/settings`} />}
        >
          {tenant.name}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={onAddTenant}>{t('addTenant')}</DropdownMenuItem>
    </>
  );
}
