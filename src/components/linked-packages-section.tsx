'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@karasu-lab/ui';
import { setPackageEnabledAction } from '@/app/actions';
import type { TenantLinkedPackage } from '@/lib/tenants';

export function LinkedPackagesSection({
  organizationId,
  packages,
}: {
  organizationId: string;
  packages: TenantLinkedPackage[];
}) {
  const t = useTranslations('Packages');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (linkedPackage: TenantLinkedPackage, enabled: boolean) => {
    setBusyId(linkedPackage.id);
    setError(null);
    try {
      await setPackageEnabledAction({ organizationId, packageId: linkedPackage.id, enabled });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        {packages.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {packages.map((linkedPackage) => (
          <div key={linkedPackage.id} className="space-y-1 rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{linkedPackage.repositoryFullName}</span>
              <span className="ml-auto flex items-center gap-2 text-sm">
                {t('autoUpdate')}
                <Switch
                  checked={linkedPackage.enabled}
                  disabled={busyId === linkedPackage.id}
                  onCheckedChange={(enabled) => toggle(linkedPackage, enabled)}
                />
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {linkedPackage.submodulePath} · {t('versionNaming')}: {linkedPackage.versionNaming}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('lastSynced')}: {linkedPackage.lastSyncedSha ?? t('notSynced')}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
