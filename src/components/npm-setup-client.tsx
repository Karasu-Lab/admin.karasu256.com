'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Spinner,
  toast,
} from '@karasu-lab/ui';
import { getNpmSetupDataAction, unlinkNpmSetupAction, type NpmSetupData } from '@/app/actions';
import { NpmSetupForm } from './npm-setup-form';

export function NpmSetupClient({ tenantId }: { tenantId?: string }) {
  const t = useTranslations('NpmSetup');
  const [data, setData] = useState<NpmSetupData | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getNpmSetupDataAction(tenantId));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  const unlink = async () => {
    if (!data?.selected) return;
    setUnlinking(true);
    try {
      await unlinkNpmSetupAction(data.selected.id);
      setUnlinkConfirmOpen(false);
      await load();
    } catch {
      toast.error(t('unlinkError'));
    } finally {
      setUnlinking(false);
    }
  };

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const loading = !data;
  const signedIn = data?.signedIn ?? false;
  const selected = data?.selected ?? null;
  const overview = data?.overview ?? null;
  const npmRepository = data?.npmRepository ?? null;
  const alreadyDone = Boolean(npmRepository?.npmRepositoryFullName && npmRepository?.workflowTemplateRepositoryFullName);

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {!loading && !signedIn && <p className="text-muted-foreground">{t('noTenant')}</p>}
      {!loading && signedIn && !selected && <p className="text-muted-foreground">{t('noTenant')}</p>}
      {!loading && selected && overview && !overview.installation && (
        <p className="text-muted-foreground">{t('noTenant')}</p>
      )}
      {selected && alreadyDone && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p>{t('alreadyDone')}</p>
            <p className="text-sm text-muted-foreground">
              {npmRepository?.npmRepositoryFullName} · {npmRepository?.workflowTemplateRepositoryFullName}
            </p>
            <Button variant="destructive" onClick={() => setUnlinkConfirmOpen(true)}>
              {t('unlink')}
            </Button>
            <Dialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
              <DialogPortal>
                <DialogBackdrop />
                <DialogPopup className="space-y-4">
                  <DialogTitle>{t('unlinkConfirmTitle')}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {t('unlinkConfirmDescription', {
                      npmRepository: npmRepository?.npmRepositoryFullName ?? '',
                      templateRepository: npmRepository?.workflowTemplateRepositoryFullName ?? '',
                    })}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setUnlinkConfirmOpen(false)} disabled={unlinking}>
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
          </CardContent>
        </Card>
      )}
      {(loading || (selected && overview?.installation)) && (
        <NpmSetupForm
          organizationId={selected?.id ?? ''}
          owner={overview?.installation?.targetLogin}
          existingRepositories={data?.repositories ?? []}
          initialNpmRepositoryName={npmRepository?.npmRepositoryName}
          initialTemplateRepositoryName={npmRepository?.workflowTemplateRepositoryName}
          disabled={loading}
          onRefresh={load}
        />
      )}
    </main>
  );
}
