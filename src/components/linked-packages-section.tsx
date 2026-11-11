'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuTrigger,
  Spinner,
  Switch,
  toast,
} from '@karasu-lab/ui';
import { MoreHorizontal, Package, Unlink } from 'lucide-react';
import { setPackageEnabledAction, unlinkPackageAction } from '@/app/actions/packages';
import type { TenantLinkedPackage } from '@/lib/tenants';
import { SettingsItemContainer, SettingsItemGroup } from './settings/settings-item-container';

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
    <>
      {packages.length === 0 && !disabled && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
      {packages.length > 0 && (
        <SettingsItemGroup>
          {packages.map((linkedPackage) => (
            <SettingsItemContainer
              key={linkedPackage.id}
              title={linkedPackage.repositoryFullName}
              icon={Package}
              trailing={
                <span className="flex items-center gap-1">
                  <Switch
                    checked={linkedPackage.enabled}
                    disabled={disabled || busyId === linkedPackage.id}
                    onCheckedChange={(enabled) => toggle(linkedPackage, enabled)}
                    aria-label={t('autoUpdate')}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button size="icon" variant="ghost" aria-label={t('menu')}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuPortal>
                      <DropdownMenuPositioner align="end" side="bottom" sideOffset={4}>
                        <DropdownMenuPopup>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive hover:text-destructive"
                            disabled={disabled}
                            onClick={() => setUnlinkTarget(linkedPackage)}
                          >
                            <Unlink className="size-4" />
                            {t('unlink')}
                          </DropdownMenuItem>
                        </DropdownMenuPopup>
                      </DropdownMenuPositioner>
                    </DropdownMenuPortal>
                  </DropdownMenu>
                </span>
              }
            />
          ))}
        </SettingsItemGroup>
      )}
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
                {unlinking ? <Spinner /> : <Unlink />}
                {t('unlink')}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </>
  );
}
