import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@karasu-lab/ui';
import { getSessionUser } from '@karasu-lab/utils/server';
import { NavSidebar } from '@/components/nav-sidebar';
import { NpmSetupForm } from '@/components/npm-setup-form';
import { getTenantOverview, listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getTenantNpmRepository, type TenantNpmRepository } from '@/lib/npm-repository';
import type { TenantOverview, TenantSummary } from '@/lib/tenants';

export default async function NpmSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const t = await getTranslations('NpmSetup');
  const user = await getSessionUser(getClientConfig().authApiUrl);

  let tenants: TenantSummary[] = [];
  let loadError: string | null = null;
  if (user) {
    try {
      tenants = await listUserTenants(user.uid);
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  }

  const params = (await searchParams) ?? {};
  const selected = tenants.find((tenant) => tenant.id === params.tenant) ?? tenants[0] ?? null;

  let overview: TenantOverview | null = null;
  let npmRepository: TenantNpmRepository | null = null;
  if (user && selected) {
    try {
      overview = await getTenantOverview(selected.id, user.uid);
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
    try {
      npmRepository = await getTenantNpmRepository(selected.id);
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  }

  const alreadyDone = Boolean(npmRepository?.npmRepositoryFullName && npmRepository?.workflowTemplateRepositoryFullName);

  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {!user && <p className="text-muted-foreground">{t('noTenant')}</p>}
        {loadError && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{loadError}</p>
            </CardContent>
          </Card>
        )}
        {user && !selected && !loadError && <p className="text-muted-foreground">{t('noTenant')}</p>}
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
        {selected && overview?.installation && !loadError && !alreadyDone && (
          <NpmSetupForm
            organizationId={selected.id}
            initialNpmRepositoryName={npmRepository?.npmRepositoryName}
            initialTemplateRepositoryName={npmRepository?.workflowTemplateRepositoryName}
          />
        )}
      </main>
    </div>
  );
}
