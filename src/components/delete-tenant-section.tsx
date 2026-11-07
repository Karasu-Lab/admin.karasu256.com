'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Spinner,
  toast,
} from '@karasu-lab/ui';

export function DeleteTenantSection({
  organizationId,
  organizationName,
  authApiUrl,
  disabled,
}: {
  organizationId: string;
  organizationName: string;
  authApiUrl: string;
  disabled?: boolean;
}) {
  const t = useTranslations('TenantSettings');
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/api/auth/organization/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: unknown; error?: unknown } | null;
        throw new Error(
          (typeof data?.message === 'string' && data.message) ||
            (typeof data?.error === 'string' && data.error) ||
            `http_${response.status}`
        );
      }
      setConfirmOpen(false);
      router.push('/');
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('deleteError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('deleteTitle')}</CardTitle>
        <CardDescription>{t('deleteDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" disabled={disabled} onClick={() => setConfirmOpen(true)}>
          {t('delete')}
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPopup className="space-y-4">
              <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
              <p className="text-sm text-muted-foreground">{t('deleteConfirmDescription', { name: organizationName })}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
                  {t('cancel')}
                </Button>
                <Button variant="destructive" onClick={remove} disabled={busy}>
                  {busy && <Spinner />}
                  {busy ? t('deleting') : t('delete')}
                </Button>
              </div>
            </DialogPopup>
          </DialogPortal>
        </Dialog>
      </CardContent>
    </Card>
  );
}
