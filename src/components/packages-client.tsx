'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { getPackagesDataAction, reregisterWebhookAction, rotateWebhookSecretAction, type PackagesData } from '@/app/actions';
import { LinkedPackagesSection } from './linked-packages-section';

export function PackagesClient({ tenantId }: { tenantId?: string }) {
  const t = useTranslations('Packages');
  const tNpmSetup = useTranslations('NpmSetup');
  const [data, setData] = useState<PackagesData | null>(null);
  const [reregistering, setReregistering] = useState(false);
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

  const handleReregisterWebhook = async () => {
    if (!selected) return;
    setReregistering(true);
    try {
      await reregisterWebhookAction(selected.id);
      toast.success(t('webhookReregistered'));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setReregistering(false);
    }
  };

  const handleRotateWebhookSecret = async () => {
    if (!selected) return;
    setRotating(true);
    try {
      await rotateWebhookSecretAction(selected.id);
      toast.success(t('webhookSecretRotated'));
      setRotateDialogOpen(false);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRotating(false);
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

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t('listTitle')}</h1>
      {!loading && !signedIn && <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>}
      {!loading && signedIn && !selected && <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>}
      {(loading || selected) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('webhookTitle')}</CardTitle>
            <CardDescription>{t('webhookDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && canManage && !webhookSecret && <p className="text-sm text-muted-foreground">{t('webhookSecretNotSet')}</p>}
            {!loading && canManage && webhookSecret && (
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">{t('webhookSecret')}</Label>
                <div className="flex gap-2">
                  <Input id="webhook-secret" value={webhookSecret} readOnly />
                  <Button variant="outline" onClick={() => void handleCopyWebhookSecret()}>
                    {t('webhookCopy')}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void handleReregisterWebhook()} disabled={loading || !canManage || !webhookSecret || reregistering || rotating}>
                {reregistering && <Spinner />}
                {reregistering ? t('webhookReregistering') : t('webhookReregister')}
              </Button>
              {!loading && canManage && !webhookSecret && (
                <Button onClick={() => setRotateDialogOpen(true)} disabled={rotating}>
                  {t('webhookSecretGenerate')}
                </Button>
              )}
              {!loading && canManage && webhookSecret && (
                <Button variant="outline" onClick={() => setRotateDialogOpen(true)} disabled={reregistering || rotating}>
                  {t('webhookSecretRotate')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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
                {rotating && <Spinner />}
                {rotating ? t('webhookSecretRotating') : webhookSecret ? t('webhookSecretRotate') : t('webhookSecretGenerate')}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </main>
  );
}
