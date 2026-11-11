'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, Input, Label, Spinner, toast } from '@karasu-lab/ui';
import { getTenantProfileAction } from '@/app/actions/dashboard';
import type { TenantProfileData } from '@/lib/dashboard-data';
import { useReportLoading } from './settings/loading-context';

export function TenantProfileClient({ tenantId, authApiUrl }: { tenantId: string; authApiUrl: string }) {
  const t = useTranslations('TenantProfile');
  const [data, setData] = useState<TenantProfileData | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await getTenantProfileAction(tenantId);
      setData(profile);
      setName(profile.name);
      setSlug(profile.slug);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${authApiUrl}/api/auth/organization/update`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: tenantId, data: { name, slug } }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: unknown; error?: unknown } | null;
        throw new Error(
          (typeof data?.message === 'string' && data.message) ||
            (typeof data?.error === 'string' && data.error) ||
            `http_${response.status}`
        );
      }
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('updateError'));
    } finally {
      setBusy(false);
    }
  };

  const loading = !data;
  useReportLoading('tenant-profile', loading);

  return (
    <main className="flex-1 space-y-6 p-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">{t('name')}</Label>
            <Input id="tenant-name" value={name} disabled={loading} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">{t('slug')}</Label>
            <Input id="tenant-slug" value={slug} disabled={loading} onChange={(event) => setSlug(event.target.value)} />
          </div>
          <Button onClick={save} disabled={busy || loading || !name || !slug}>
            {busy && <Spinner />}
            {busy ? t('saving') : t('save')}
          </Button>
        </CardContent>
      </Card>
      <Button variant="outline" render={<Link href={`/tenants/${tenantId}/tenant-settings`} />}>
        {t('openTenantSettings')}
      </Button>
    </main>
  );
}
