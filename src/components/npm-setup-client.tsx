'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, toast } from '@karasu-lab/ui';
import { getNpmSetupDataAction, type NpmSetupData } from '@/app/actions';
import { NpmSetupForm } from './npm-setup-form';

export function NpmSetupClient({ tenantId }: { tenantId?: string }) {
  const t = useTranslations('NpmSetup');
  const [data, setData] = useState<NpmSetupData | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getNpmSetupDataAction(tenantId));
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

  const { signedIn, selected, overview, npmRepository } = data;
  const alreadyDone = Boolean(npmRepository?.npmRepositoryFullName && npmRepository?.workflowTemplateRepositoryFullName);

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {!signedIn && <p className="text-muted-foreground">{t('noTenant')}</p>}
      {signedIn && !selected && <p className="text-muted-foreground">{t('noTenant')}</p>}
      {selected && overview && !overview.installation && (
        <p className="text-muted-foreground">{t('noTenant')}</p>
      )}
      {selected && alreadyDone && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p>{t('alreadyDone')}</p>
            <p className="text-sm text-muted-foreground">
              {npmRepository?.npmRepositoryFullName} · {npmRepository?.workflowTemplateRepositoryFullName}
            </p>
          </CardContent>
        </Card>
      )}
      {selected && overview?.installation && !alreadyDone && (
        <NpmSetupForm
          organizationId={selected.id}
          initialNpmRepositoryName={npmRepository?.npmRepositoryName}
          initialTemplateRepositoryName={npmRepository?.workflowTemplateRepositoryName}
          onRefresh={load}
        />
      )}
    </main>
  );
}
