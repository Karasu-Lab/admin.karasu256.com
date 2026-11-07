'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@karasu-lab/ui';
import { startNpmSetupAction } from '@/app/actions';

export function NpmSetupForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations('NpmSetup');
  const router = useRouter();
  const [npmName, setNpmName] = useState('npm');
  const [templateName, setTemplateName] = useState('workflow-templates');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startNpmSetupAction({
        organizationId,
        npmRepositoryName: npmName,
        templateRepositoryName: templateName,
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="npm-repository-name">{t('npmRepositoryName')}</Label>
          <Input id="npm-repository-name" value={npmName} onChange={(event) => setNpmName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-repository-name">{t('templateRepositoryName')}</Label>
          <Input
            id="template-repository-name"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={start} disabled={busy || !npmName || !templateName}>
          {busy ? t('starting') : t('start')}
        </Button>
      </CardContent>
    </Card>
  );
}
