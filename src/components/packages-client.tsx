'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Input,
  Label,
  Spinner,
  toast,
} from '@karasu-lab/ui';
import { Copy, Plus, RefreshCw, Webhook } from 'lucide-react';
import { getPackagesDataAction } from '@/app/actions/dashboard';
import { rotateWebhookSecretAction } from '@/app/actions/tenant';
import type { PackagesData } from '@/lib/dashboard-data';
import { LinkedPackagesSection } from './linked-packages-section';
import { useReportLoading } from './settings/loading-context';
import { SettingsItemContainer } from './settings/settings-item-container';

export function PackagesClient({ tenantId }: { tenantId?: string }) {
  const t = useTranslations('Packages');
  const tNpmSetup = useTranslations('NpmSetup');
  const [data, setData] = useState<PackagesData | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getPackagesDataAction(tenantId));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const loading = !data;
  const signedIn = data?.signedIn ?? false;
  const selected = data?.selected ?? null;
  const overview = data?.overview ?? null;
  const webhookSecret = data?.webhookSecret ?? null;
  const canManage = overview?.organization.role === 'owner' || overview?.organization.role === 'admin';

  const handleRotateWebhookSecret = async () => {
    if (!selected) return;
    setRotating(true);
    try {
      await rotateWebhookSecretAction(selected.id);
      toast.success(t('webhookSecretRotated'));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRotating(false);
      setRotateDialogOpen(false);
      await load();
    }
  };

  const handleCopyWebhookSecret = async () => {
    if (!webhookSecret) return;
    try {
      await navigator.clipboard.writeText(webhookSecret);
      toast.success(t('webhookSecretCopied'));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  };

  useReportLoading('packages', loading);

  return (
    <main className="flex-1 space-y-6 p-6">
      {!loading && !signedIn && <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>}
      {!loading && signedIn && !selected && <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>}
      {(loading || selected) && (
        <SettingsItemContainer
          title={t('webhookTitle')}
          description={!loading && canManage && !webhookSecret ? t('webhookSecretNotSet') : undefined}
          icon={Webhook}
          iconBackgroundColor="#af52de"
        >
          <div className="space-y-4">
            {!loading && canManage && webhookSecret && (
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">{t('webhookSecret')}</Label>
                <div className="flex gap-2">
                  <Input id="webhook-secret" value={webhookSecret} readOnly />
                  <Button variant="outline" onClick={() => void handleCopyWebhookSecret()}>
                    <Copy />
                    {t('webhookCopy')}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRotateDialogOpen(true)} disabled={loading || !canManage || rotating}>
                {webhookSecret ? <RefreshCw /> : <Plus />}
                {webhookSecret ? t('webhookSecretRotate') : t('webhookSecretGenerateShort')}
              </Button>
            </div>
          </div>
        </SettingsItemContainer>
      )}
      {(loading || selected) && (
        <LinkedPackagesSection
          organizationId={selected?.id ?? ''}
          packages={overview?.linkedPackages ?? []}
          disabled={loading}
          onRefresh={load}
        />
      )}
      <Dialog open={rotateDialogOpen} onOpenChange={(open) => !open && setRotateDialogOpen(false)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="space-y-4">
            <DialogTitle>{webhookSecret ? t('webhookSecretRotateConfirmTitle') : t('webhookSecretGenerateConfirmTitle')}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {webhookSecret ? t('webhookSecretRotateConfirmDescription') : t('webhookSecretGenerateConfirmDescription')}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRotateDialogOpen(false)} disabled={rotating}>
                {t('cancel')}
              </Button>
              <Button onClick={() => void handleRotateWebhookSecret()} disabled={rotating}>
                {rotating ? <Spinner /> : webhookSecret ? <RefreshCw /> : <Plus />}
                {webhookSecret ? t('webhookSecretRotate') : t('webhookSecretGenerateShort')}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </main>
  );
}
