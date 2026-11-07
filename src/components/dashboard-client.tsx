'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner, toast } from '@karasu-lab/ui';
import { getDashboardDataAction, markSetupCompletedAction, type DashboardData } from '@/app/actions';
import { LiveFeed } from './live-feed';
import { RepositoryImport } from './repository-import';

interface Step {
  done: boolean;
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}

export function DashboardClient({ tenantId }: { tenantId?: string }) {
  const t = useTranslations('Dashboard');
  const tOnboarding = useTranslations('Onboarding');
  const [data, setData] = useState<DashboardData | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getDashboardDataAction(tenantId));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const loading = !data;

  if (data && !data.signedIn) {
    return (
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('signInRequired')}</p>
      </main>
    );
  }

  const tenants = data?.tenants ?? [];
  const selected = data?.selected ?? null;
  const setupCompleted = data?.setupCompleted ?? false;
  const overview = data?.overview ?? null;
  const npmRepository = data?.npmRepository ?? null;
  const repositories = data?.repositories ?? [];
  const settingsHref = selected ? `/tenants/${selected.id}/tenant-settings` : undefined;
  const setupRepositoryFullNames = [npmRepository?.npmRepositoryFullName, npmRepository?.workflowTemplateRepositoryFullName].filter(
    (name): name is string => Boolean(name)
  );
  const steps: Step[] = [
    {
      done: Boolean(selected),
      title: tOnboarding('tenant'),
      description: tOnboarding('tenantDescription'),
    },
    {
      done: Boolean(overview?.installation),
      title: tOnboarding('bot'),
      description: tOnboarding('botDescription'),
      href: settingsHref,
      hrefLabel: tOnboarding('startSetup'),
    },
    {
      done: Boolean(overview?.signingKeys.some((key) => key.enabled && key.registeredOnGitHub)),
      title: tOnboarding('signingKey'),
      description: tOnboarding('signingKeyDescription'),
      href: settingsHref,
      hrefLabel: tOnboarding('startSetup'),
    },
    {
      done: Boolean(npmRepository?.npmRepositoryFullName),
      title: tOnboarding('npmRepository'),
      description: tOnboarding('npmRepositoryDescription'),
      href: selected ? `/setup?tenant=${selected.id}` : undefined,
      hrefLabel: tOnboarding('startSetup'),
    },
    {
      done: Boolean(npmRepository?.workflowTemplateRepositoryFullName),
      title: tOnboarding('templateRepository'),
      description: tOnboarding('templateRepositoryDescription'),
      href: selected ? `/setup?tenant=${selected.id}` : undefined,
      hrefLabel: tOnboarding('startSetup'),
    },
    {
      done: Boolean(overview?.installation),
      title: tOnboarding('webhook'),
      description: tOnboarding('webhookDescription'),
    },
    {
      done: Boolean(overview && overview.linkedPackages.length > 0),
      title: tOnboarding('package'),
      description: tOnboarding('packageDescription'),
      href: selected ? `/packages?tenant=${selected.id}` : undefined,
      hrefLabel: tOnboarding('openPackages'),
    },
  ];
  const allStepsDone = steps.every((step) => step.done);

  const markCompleted = async () => {
    if (!selected) return;
    setMarking(true);
    try {
      await markSetupCompletedAction(selected.id);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setMarking(false);
    }
  };

  return (
    <main className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {!loading && tenants.length === 0 && <p className="text-muted-foreground">{t('noTenants')}</p>}
      {!loading && tenants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tenants.map((tenant) => (
            <Button
              key={tenant.id}
              variant={tenant.id === selected?.id ? 'default' : 'outline'}
              render={<Link href={`/?tenant=${tenant.id}`} />}
            >
              {tenant.name}
            </Button>
          ))}
        </div>
      )}
      {(loading || selected) && !setupCompleted && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>
                {tOnboarding('title')}
                {selected ? ` — ${selected.name}` : ''}
              </CardTitle>
              {!loading && settingsHref && (
                <Button variant="outline" className="ml-auto" render={<Link href={settingsHref} />}>
                  {tOnboarding('openSettings')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.title} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                {!loading && (
                  <Badge variant={step.done ? 'default' : 'secondary'}>
                    {step.done ? tOnboarding('completed') : tOnboarding('notCompleted')}
                  </Badge>
                )}
                <div className="min-w-0">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {!loading && !step.done && step.href && (
                  <Button variant="outline" className="ml-auto" render={<Link href={step.href} />}>
                    {step.hrefLabel}
                  </Button>
                )}
                {!loading && index === steps.length - 1 && (
                  <Button className={!step.done && step.href ? undefined : 'ml-auto'} disabled={!allStepsDone || marking} onClick={markCompleted}>
                    {marking && <Spinner />}
                    {marking ? tOnboarding('markingCompleted') : tOnboarding('markCompleted')}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {(loading || selected) && <LiveFeed tenantId={selected?.id} disabled={loading} />}
      {loading && (
        <RepositoryImport organizationId={tenantId} repositories={[]} linkedFullNames={[]} disabled excludedFullNames={setupRepositoryFullNames} />
      )}
      {!loading && selected && overview?.installation && (
        <RepositoryImport
          organizationId={selected.id}
          repositories={repositories}
          linkedFullNames={overview.linkedPackages.map((linked) => linked.repositoryFullName)}
          onRefresh={load}
          excludedFullNames={setupRepositoryFullNames}
        />
      )}
    </main>
  );
}
