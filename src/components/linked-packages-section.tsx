'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
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
  Switch,
  toast,
} from '@karasu-lab/ui';
import { setPackageEnabledAction, unlinkPackageAction } from '@/app/actions';
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
  onRefresh?: () => Promise<void> | void;
}) {
  const t = useTranslations('Packages');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<TenantLinkedPackage | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const refresh = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      router.refresh();
    }
  };

  const toggle = async (linkedPackage: TenantLinkedPackage, enabled: boolean) => {
    setBusyId(linkedPackage.id);
    try {
      await setPackageEnabledAction({ organizationId, packageId: linkedPackage.id, enabled });
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyId(null);
    }
  };

  const unlink = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      await unlinkPackageAction({ organizationId, packageId: unlinkTarget.id });
      setUnlinkTarget(null);
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUnlinking(false);
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
          <div key={linkedPackage.id} className="space-y-2 rounded-md border p-4">
            <div className="min-w-0 font-medium break-words">{linkedPackage.repositoryFullName}</div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" disabled={disabled} onClick={() => setUnlinkTarget(linkedPackage)}>
                {t('unlink')}
              </Button>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-sm">{t('autoUpdate')}</span>
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
      <Dialog open={unlinkTarget !== null} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="space-y-4">
            <DialogTitle>{t('unlinkConfirmTitle')}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t('unlinkConfirmDescription', { repository: unlinkTarget?.repositoryFullName ?? '' })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUnlinkTarget(null)} disabled={unlinking}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" onClick={unlink} disabled={unlinking}>
                {unlinking && <Spinner />}
                {unlinking ? t('unlinking') : t('unlink')}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </Card>
  );
}
