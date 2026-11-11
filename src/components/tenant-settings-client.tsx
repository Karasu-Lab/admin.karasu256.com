'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Spinner,
  toast,
} from '@karasu-lab/ui';
import { ArrowRight, Bot, Package, Plus, Trash2 } from 'lucide-react';
import { getTenantSettingsDataAction } from '@/app/actions/dashboard';
import { getGithubAppInstallUrlAction, uninstallBotAction } from '@/app/actions/tenant';
import type { TenantSettingsData } from '@/lib/dashboard-data';
import { requestProviderLinkUrl } from '@/lib/provider-link';
import { DeleteTenantSection } from './delete-tenant-section';
import { SettingsItemContainer } from './settings/settings-item-container';
import { useReportLoading } from './settings/loading-context';

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
  useReportLoading('tenant-settings', loading);

  return (
    <main className="flex-1 space-y-6 p-6">
      {(loading || overview) && (
        <>
          <SettingsItemContainer
            title={t('installation')}
            description={
              overview?.installation
                ? `${t('installedOn')}: ${overview.installation.targetLogin} (${overview.installation.targetType})`
                : !loading
                  ? t('notInstalled')
                  : undefined
            }
            icon={Bot}
            iconBackgroundColor="#5856d6"
            trailing={
              overview?.installation?.suspended ? <Badge variant="secondary">{t('suspended')}</Badge> : undefined
            }
          >
            {overview?.installation ? (
              <>
                <Button variant="destructive" disabled={loading} onClick={() => setUninstallConfirmOpen(true)}>
                  <Trash2 />
                  {t('uninstallShort')}
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
                          {uninstalling ? <Spinner /> : <Trash2 />}
                          {t('uninstallShort')}
                        </Button>
                      </div>
                    </DialogPopup>
                  </DialogPortal>
                </Dialog>
              </>
            ) : (
              <Button disabled={loading || installing} onClick={install}>
                {installing ? <Spinner /> : <Plus />}
                {t('installShort')}
              </Button>
            )}
          </SettingsItemContainer>
          <SettingsItemContainer
            title={t('npm')}
            description={!npmRepository?.npmRepositoryFullName && !loading ? t('notConfigured') : undefined}
            icon={Package}
            iconBackgroundColor="#cb3837"
          >
            {npmRepository?.npmRepositoryFullName ? (
              <div className="space-y-2">
                <p className="text-sm">
                  {t('npmRepository')}: {npmRepository.npmRepositoryFullName}
                </p>
                <p className="text-sm">
                  {t('templateRepository')}: {npmRepository.workflowTemplateRepositoryFullName}
                </p>
              </div>
            ) : (
              <Button variant="outline" disabled={loading} render={<Link href={`/setup?tenant=${tenantId}`} />}>
                <ArrowRight />
                {t('openSetupShort')}
              </Button>
            )}
          </SettingsItemContainer>
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
