'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, Input, Label, Spinner, toast } from '@karasu-lab/ui';
import { getTenantProfileAction, type TenantProfileData } from '@/app/actions';

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
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch {
      toast.error(t('updateError'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">
        {t('title')}
        {` — ${data.name}`}
      </h1>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">{t('name')}</Label>
            <Input id="tenant-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">{t('slug')}</Label>
            <Input id="tenant-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </div>
          <Button onClick={save} disabled={busy || !name || !slug}>
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
