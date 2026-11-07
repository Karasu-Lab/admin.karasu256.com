'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Spinner,
  toast,
} from '@karasu-lab/ui';
import { getGithubAppInstallUrlAction, getTenantSettingsDataAction, uninstallBotAction, type TenantSettingsData } from '@/app/actions';
import { requestProviderLinkUrl } from '@/lib/provider-link';
import { DeleteTenantSection } from './delete-tenant-section';
import { LinkedPackagesSection } from './linked-packages-section';
import { SigningKeysSection } from './signing-keys-section';

export function TenantSettingsClient({
  tenantId,
  authApiUrl,
  settingsUrl,
}: {
  tenantId: string;
  authApiUrl: string;
  settingsUrl: string;
}) {
  const t = useTranslations('TenantSettings');
  const [data, setData] = useState<TenantSettingsData | null>(null);
  const [uninstallConfirmOpen, setUninstallConfirmOpen] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [installing, setInstalling] = useState(false);

  const install = async () => {
    setInstalling(true);
    try {
      const authorizeUrl = await requestProviderLinkUrl(authApiUrl, 'github-app', settingsUrl, { organizationId: tenantId });
      const state = new URL(authorizeUrl).searchParams.get('state');
      if (!state) throw new Error(t('installError'));
      const installUrl = await getGithubAppInstallUrlAction();
      window.location.href = `${installUrl}?state=${encodeURIComponent(state)}`;
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('installError'));
      setInstalling(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setData(await getTenantSettingsDataAction(tenantId));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  const uninstall = async () => {
    setUninstalling(true);
    try {
      await uninstallBotAction(tenantId);
      setUninstallConfirmOpen(false);
      await load();
    } catch {
      toast.error(t('uninstallError'));
    } finally {
      setUninstalling(false);
    }
  };

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const overview = data?.overview;
  const npmRepository = data?.npmRepository;
  const loading = !data;

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">
        {t('title')}
        {overview ? ` — ${overview.organization.name}` : ''}
      </h1>
      {(loading || overview) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('installation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview?.installation ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {t('installedOn')}: {overview.installation.targetLogin} ({overview.installation.targetType})
                    </span>
                    {overview.installation.suspended && <Badge variant="secondary">{t('suspended')}</Badge>}
                  </div>
                  <Button variant="destructive" disabled={loading} onClick={() => setUninstallConfirmOpen(true)}>
                    {t('uninstall')}
                  </Button>
                  <Dialog open={uninstallConfirmOpen} onOpenChange={setUninstallConfirmOpen}>
                    <DialogPortal>
                      <DialogBackdrop />
                      <DialogPopup className="space-y-4">
                        <DialogTitle>{t('uninstallConfirmTitle')}</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                          {t('uninstallConfirmDescription', { login: overview.installation.targetLogin })}
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setUninstallConfirmOpen(false)} disabled={uninstalling}>
                            {t('cancel')}
                          </Button>
                          <Button variant="destructive" onClick={uninstall} disabled={uninstalling}>
                            {uninstalling && <Spinner />}
                            {uninstalling ? t('uninstalling') : t('uninstall')}
                          </Button>
                        </div>
                      </DialogPopup>
                    </DialogPortal>
                  </Dialog>
                </>
              ) : (
                <>
                  {!loading && <p className="text-sm text-muted-foreground">{t('notInstalled')}</p>}
                  <Button disabled={loading || installing} onClick={install}>
                    {installing && <Spinner />}
                    {t('install')}
                  </Button>
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
                  {!loading && <p className="text-sm text-muted-foreground">{t('notConfigured')}</p>}
                  <Button variant="outline" disabled={loading} render={<Link href={`/npm-setup?tenant=${tenantId}`} />}>
                    {t('openSetup')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          <LinkedPackagesSection organizationId={tenantId} packages={overview?.linkedPackages ?? []} disabled={loading} onRefresh={load} />
          <SigningKeysSection
            authApiUrl={authApiUrl}
            settingsUrl={settingsUrl}
            keys={overview?.signingKeys ?? []}
            disabled={loading}
            onRefresh={load}
          />
          <DeleteTenantSection
            organizationId={tenantId}
            organizationName={overview?.organization.name ?? ''}
            authApiUrl={authApiUrl}
            disabled={loading}
          />
        </>
      )}
    </main>
  );
}
