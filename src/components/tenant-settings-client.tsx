'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, toast } from '@karasu-lab/ui';
import { getTenantSettingsDataAction, type TenantSettingsData } from '@/app/actions';
import { DeleteTenantSection } from './delete-tenant-section';
import { LinkedPackagesSection } from './linked-packages-section';
import { SigningKeysSection } from './signing-keys-section';

export function TenantSettingsClient({
  tenantId,
  authApiUrl,
  settingsUrl,
  installUrl,
}: {
  tenantId: string;
  authApiUrl: string;
  settingsUrl: string;
  installUrl: string;
}) {
  const t = useTranslations('TenantSettings');
  const [data, setData] = useState<TenantSettingsData | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getTenantSettingsDataAction(tenantId));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  if (!data) {
    return (
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </main>
    );
  }

  const { overview, npmRepository } = data;

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">
        {t('title')}
        {overview ? ` — ${overview.organization.name}` : ''}
      </h1>
      {overview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('installation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.installation ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {t('installedOn')}: {overview.installation.targetLogin} ({overview.installation.targetType})
                  </span>
                  {overview.installation.suspended && <Badge variant="secondary">{t('suspended')}</Badge>}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t('notInstalled')}</p>
                  <Button render={<a href={installUrl} />}>{t('install')}</Button>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('npm')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {npmRepository?.npmRepositoryFullName ? (
                <>
                  <p className="text-sm">
                    {t('npmRepository')}: {npmRepository.npmRepositoryFullName}
                  </p>
                  <p className="text-sm">
                    {t('templateRepository')}: {npmRepository.workflowTemplateRepositoryFullName}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t('notConfigured')}</p>
                  <Button variant="outline" render={<Link href={`/npm-setup?tenant=${tenantId}`} />}>
                    {t('openSetup')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          <LinkedPackagesSection organizationId={tenantId} packages={overview.linkedPackages} onRefresh={load} />
          <SigningKeysSection authApiUrl={authApiUrl} settingsUrl={settingsUrl} keys={overview.signingKeys} onRefresh={load} />
          <DeleteTenantSection organizationId={tenantId} organizationName={overview.organization.name} authApiUrl={authApiUrl} />
        </>
      )}
    </main>
  );
}
