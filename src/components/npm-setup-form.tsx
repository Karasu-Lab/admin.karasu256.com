'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, toast } from '@karasu-lab/ui';
import { startNpmSetupAction } from '@/app/actions';

export function NpmSetupForm({
  organizationId,
  initialNpmRepositoryName,
  initialTemplateRepositoryName,
  onRefresh,
}: {
  organizationId: string;
  initialNpmRepositoryName?: string;
  initialTemplateRepositoryName?: string;
  onRefresh?: () => void;
}) {
  const t = useTranslations('NpmSetup');
  const router = useRouter();
  const [npmName, setNpmName] = useState(initialNpmRepositoryName ?? 'npm');
  const [templateName, setTemplateName] = useState(initialTemplateRepositoryName ?? 'workflow-templates');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await startNpmSetupAction({
        organizationId,
        npmRepositoryName: npmName,
        templateRepositoryName: templateName,
      });
      if (onRefresh) {
        onRefresh();
      } else {
        router.refresh();
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('error'));
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
        <Button onClick={start} disabled={busy || !npmName || !templateName}>
          {busy ? t('starting') : t('start')}
        </Button>
      </CardContent>
    </Card>
  );
}
