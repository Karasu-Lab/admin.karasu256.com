'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DropdownMenuItem, DropdownMenuSeparator } from '@karasu-lab/ui';
import { Link } from '@/i18n/navigation';
import type { TenantSummary } from '@/lib/tenants';
import { CreateTenantDialog } from './create-tenant-dialog';

export function TenantMenuSection({ tenants, authApiUrl }: { tenants: TenantSummary[]; authApiUrl: string }) {
  const t = useTranslations('header');
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2 py-1 text-xs text-muted-foreground">{t('tenants')}</div>
      {tenants.map((tenant) => (
        <DropdownMenuItem
          key={tenant.id}
          render={<Link href={`/tenants/${tenant.id}/settings`} />}
        >
          {tenant.name}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={() => setDialogOpen(true)}>{t('addTenant')}</DropdownMenuItem>
      <CreateTenantDialog open={dialogOpen} onOpenChange={setDialogOpen} authApiUrl={authApiUrl} />
    </>
  );
}
