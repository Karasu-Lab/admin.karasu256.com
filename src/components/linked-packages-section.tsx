'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, Switch, toast } from '@karasu-lab/ui';
import { setPackageEnabledAction } from '@/app/actions';
import type { TenantLinkedPackage } from '@/lib/tenants';

export function LinkedPackagesSection({
  organizationId,
  packages,
  disabled,
  onRefresh,
}: {
  organizationId: string;
  packages: TenantLinkedPackage[];
  disabled?: boolean;
  onRefresh?: () => void;
}) {
  const t = useTranslations('Packages');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (linkedPackage: TenantLinkedPackage, enabled: boolean) => {
    setBusyId(linkedPackage.id);
    try {
      await setPackageEnabledAction({ organizationId, packageId: linkedPackage.id, enabled });
      if (onRefresh) {
        onRefresh();
      } else {
        router.refresh();
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {packages.length === 0 && !disabled && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {packages.map((linkedPackage) => (
          <div key={linkedPackage.id} className="rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{linkedPackage.repositoryFullName}</span>
              <span className="flex items-center gap-2 text-sm">
                {t('autoUpdate')}
                <Switch
                  checked={linkedPackage.enabled}
                  disabled={disabled || busyId === linkedPackage.id}
                  onCheckedChange={(enabled) => toggle(linkedPackage, enabled)}
                />
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
