'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Spinner, toast } from '@karasu-lab/ui';
import { startNpmSetupAction, type RepositorySetupOutcome } from '@/app/actions';
import type { InstallationRepository } from '@/lib/tenants';

type RepositoryPlan = 'create' | 'overwrite' | 'blocked';

export function NpmSetupForm({
  organizationId,
  owner,
  existingRepositories,
  initialNpmRepositoryName,
  initialTemplateRepositoryName,
  disabled,
  onRefresh,
}: {
  organizationId: string;
  owner?: string;
  existingRepositories: InstallationRepository[];
  initialNpmRepositoryName?: string;
  initialTemplateRepositoryName?: string;
  disabled?: boolean;
  onRefresh?: () => void;
}) {
  const t = useTranslations('NpmSetup');
  const router = useRouter();
  const [npmName, setNpmName] = useState(initialNpmRepositoryName ?? 'npm');
  const [templateName, setTemplateName] = useState(initialTemplateRepositoryName ?? 'workflow-templates');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNpmName(initialNpmRepositoryName ?? 'npm');
  }, [initialNpmRepositoryName]);

  useEffect(() => {
    setTemplateName(initialTemplateRepositoryName ?? 'workflow-templates');
  }, [initialTemplateRepositoryName]);

  const planFor = (name: string): { plan: RepositoryPlan; fullName: string } | null => {
    if (!owner || !name) return null;
    const fullName = `${owner}/${name}`;
    const existing = existingRepositories.find(
      (repository) => repository.fullName.toLowerCase() === fullName.toLowerCase()
    );
    if (!existing) return { plan: 'create', fullName };
    return { plan: existing.private ? 'blocked' : 'overwrite', fullName: existing.fullName };
  };

  const npmPlan = disabled ? null : planFor(npmName);
  const templatePlan = disabled ? null : planFor(templateName);
  const plans = [npmPlan, templatePlan].filter((entry) => entry !== null);
  const blocked = plans.some((entry) => entry.plan === 'blocked');
  const overwriteCount = plans.filter((entry) => entry.plan === 'overwrite').length;
  const combination =
    plans.length === 0 || overwriteCount === 0 ? 'create' : overwriteCount === plans.length ? 'overwrite' : 'both';

  const planText = (entry: { plan: RepositoryPlan; fullName: string }): string => {
    if (entry.plan === 'create') return t('willCreate', { fullName: entry.fullName });
    if (entry.plan === 'overwrite') return t('willOverwrite', { fullName: entry.fullName });
    return t('cannotOverwritePrivate', { fullName: entry.fullName });
  };

  const start = async () => {
    setBusy(true);
    try {
      const result = await startNpmSetupAction({
        organizationId,
        npmRepositoryName: npmName,
        templateRepositoryName: templateName,
      });
      const outcomes: RepositorySetupOutcome[] = [result.npmRepositoryOutcome, result.templateRepositoryOutcome];
      const overwritten = outcomes.filter((outcome) => outcome === 'overwritten').length;
      toast.success(overwritten === 0 ? t('done') : overwritten === outcomes.length ? t('doneOverwritten') : t('doneBoth'));
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
          <Input
            id="npm-repository-name"
            value={npmName}
            disabled={disabled}
            onChange={(event) => setNpmName(event.target.value)}
          />
          {npmPlan && <p className="text-sm text-muted-foreground">{planText(npmPlan)}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-repository-name">{t('templateRepositoryName')}</Label>
          <Input
            id="template-repository-name"
            value={templateName}
            disabled={disabled}
            onChange={(event) => setTemplateName(event.target.value)}
          />
          {templatePlan && <p className="text-sm text-muted-foreground">{planText(templatePlan)}</p>}
        </div>
        <Button onClick={start} disabled={disabled || busy || blocked || !npmName || !templateName}>
          {busy && <Spinner />}
          {busy
            ? combination === 'overwrite'
              ? t('startingOverwrite')
              : combination === 'both'
                ? t('startingBoth')
                : t('starting')
            : combination === 'overwrite'
              ? t('startOverwrite')
              : combination === 'both'
                ? t('startBoth')
                : t('start')}
        </Button>
      </CardContent>
    </Card>
  );
}
