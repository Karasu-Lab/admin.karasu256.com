import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@karasu-lab/ui';
import { getSessionUser } from '@karasu-lab/utils/server';
import { NavSidebar } from '@/components/nav-sidebar';
import { RepositoryImport } from '@/components/repository-import';
import { getTenantOverview, listTenantRepositories, listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getTenantNpmRepository, type TenantNpmRepository } from '@/lib/npm-repository';
import type { InstallationRepository, TenantOverview, TenantSummary } from '@/lib/tenants';

interface Step {
  done: boolean;
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const t = await getTranslations('Dashboard');
  const tOnboarding = await getTranslations('Onboarding');
  const user = await getSessionUser(getClientConfig().authApiUrl);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <NavSidebar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-4 text-muted-foreground">{t('signInRequired')}</p>
        </main>
      </div>
    );
  }

  let tenants: TenantSummary[] = [];
  let tenantsError: string | null = null;
  try {
    tenants = await listUserTenants(user.uid);
  } catch (error) {
    tenantsError = error instanceof Error ? error.message : String(error);
  }

  const params = (await searchParams) ?? {};
  const selected = tenants.find((tenant) => tenant.id === params.tenant) ?? tenants[0] ?? null;

  let overview: TenantOverview | null = null;
  let overviewError: string | null = null;
  let npmRepository: TenantNpmRepository | null = null;
  let repositories: InstallationRepository[] = [];
  let repositoriesError: string | null = null;
  if (selected) {
    try {
      overview = await getTenantOverview(selected.id, user.uid);
    } catch (error) {
      overviewError = error instanceof Error ? error.message : String(error);
    }
    try {
      npmRepository = await getTenantNpmRepository(selected.id);
    } catch (error) {
      overviewError = error instanceof Error ? error.message : String(error);
    }
    if (overview?.installation) {
      try {
        repositories = await listTenantRepositories(selected.id);
      } catch (error) {
        repositoriesError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  const settingsHref = selected ? `/tenants/${selected.id}/settings` : undefined;
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
      href: selected ? `/npm-setup?tenant=${selected.id}` : undefined,
      hrefLabel: tOnboarding('startSetup'),
    },
    {
      done: Boolean(npmRepository?.workflowTemplateRepositoryFullName),
      title: tOnboarding('templateRepository'),
      description: tOnboarding('templateRepositoryDescription'),
      href: selected ? `/npm-setup?tenant=${selected.id}` : undefined,
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
      href: settingsHref,
      hrefLabel: tOnboarding('openSettings'),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavSidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {tenantsError && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {t('loadError')}: {tenantsError}
              </p>
            </CardContent>
          </Card>
        )}
        {!tenantsError && tenants.length === 0 && <p className="text-muted-foreground">{t('noTenants')}</p>}
        {tenants.length > 1 && (
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
        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>
                {tOnboarding('title')} — {selected.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overviewError && (
                <p className="text-sm text-destructive">
                  {t('loadError')}: {overviewError}
                </p>
              )}
              {steps.map((step) => (
                <div key={step.title} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <Badge variant={step.done ? 'default' : 'secondary'}>
                    {step.done ? tOnboarding('completed') : tOnboarding('notCompleted')}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {!step.done && step.href && (
                    <Button variant="outline" className="ml-auto" render={<Link href={step.href} />}>
                      {step.hrefLabel}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {selected && overview?.installation && (
          <RepositoryImport
            organizationId={selected.id}
            repositories={repositories}
            linkedFullNames={overview.linkedPackages.map((linked) => linked.repositoryFullName)}
            loadError={repositoriesError}
          />
        )}
      </main>
    </div>
  );
}
