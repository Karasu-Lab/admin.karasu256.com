'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner, toast } from '@karasu-lab/ui';
import { getPackagesDataAction, reregisterWebhookAction, type PackagesData } from '@/app/actions';
import { LinkedPackagesSection } from './linked-packages-section';

export function PackagesClient({ tenantId }: { tenantId?: string }) {
  const t = useTranslations('Packages');
  const tNpmSetup = useTranslations('NpmSetup');
  const [data, setData] = useState<PackagesData | null>(null);
  const [reregistering, setReregistering] = useState(false);

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
          <CardContent>
            <Button onClick={() => void handleReregisterWebhook()} disabled={loading || !canManage || reregistering}>
              {reregistering && <Spinner />}
              {reregistering ? t('webhookReregistering') : t('webhookReregister')}
            </Button>
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
    </main>
  );
}
