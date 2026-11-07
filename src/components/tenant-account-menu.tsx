'use client';

import { useState } from 'react';
import { AccountMenu } from '@karasu-lab/ui';
import type { TenantSummary } from '@/lib/tenants';
import { CreateTenantDialog } from './create-tenant-dialog';
import { TenantMenuSection } from './tenant-menu-section';

export function TenantAccountMenu({
  tenants,
  authApiUrl,
  signInHref,
  onSignOut,
  labels,
  triggerAriaLabel,
}: {
  tenants: TenantSummary[];
  authApiUrl: string;
  signInHref: string;
  onSignOut: () => void | Promise<void>;
  labels: { signIn: string; signOut: string };
  triggerAriaLabel: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <AccountMenu
        signInHref={signInHref}
        onSignOut={onSignOut}
        labels={labels}
        triggerAriaLabel={triggerAriaLabel}
      >
        <TenantMenuSection tenants={tenants} onAddTenant={() => setDialogOpen(true)} />
      </AccountMenu>
      <CreateTenantDialog open={dialogOpen} onOpenChange={setDialogOpen} authApiUrl={authApiUrl} />
    </>
  );
}
