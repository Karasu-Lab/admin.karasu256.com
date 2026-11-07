import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@karasu-lab/ui';
import { getSessionUser } from '@karasu-lab/utils/server';
import { NavSidebar } from '@/components/nav-sidebar';
import { LinkedPackagesSection } from '@/components/linked-packages-section';
import { SigningKeysSection } from '@/components/signing-keys-section';
import { getTenantOverview } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getTenantNpmRepository, type TenantNpmRepository } from '@/lib/npm-repository';
import type { TenantOverview } from '@/lib/tenants';

export default async function TenantSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('TenantSettings');
  const clientConfig = getClientConfig();
  const user = await getSessionUser(clientConfig.authApiUrl);
  const authApiUrl = clientConfig.authApiUrl;
  const settingsUrl = `${clientConfig.appUrl}/tenants/${id}/settings`;

  if (!user) {
    throw new Error('unauthorized');
  }
  const overview: TenantOverview = await getTenantOverview(id, user.uid);
  const npmRepository: TenantNpmRepository | null = await getTenantNpmRepository(id);

  const installUrl = `${authApiUrl}/api/github-app/install?organizationId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(settingsUrl)}`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavSidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">
          {t('title')}
          {overview ? ` — ${overview.organization.name}` : ''}
        </h1>
        {overview && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t('installation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.installation ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {t('installedOn')}: {overview.installation.targetLogin} ({overview.installation.targetType})
                    </span>
                    {overview.installation.suspended && <Badge variant="secondary">{t('suspended')}</Badge>}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{t('notInstalled')}</p>
                    <Button render={<a href={installUrl} />}>{t('install')}</Button>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('npm')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {npmRepository?.npmRepositoryFullName ? (
                  <>
                    <p className="text-sm">
                      {t('npmRepository')}: {npmRepository.npmRepositoryFullName}
                    </p>
                    <p className="text-sm">
                      {t('templateRepository')}: {npmRepository.workflowTemplateRepositoryFullName}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{t('notConfigured')}</p>
                    <Button variant="outline" render={<Link href={`/npm-setup?tenant=${id}`} />}>
                      {t('openSetup')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            <LinkedPackagesSection organizationId={id} packages={overview.linkedPackages} />
            <SigningKeysSection authApiUrl={authApiUrl} settingsUrl={settingsUrl} keys={overview.signingKeys} />
          </>
        )}
      </main>
    </div>
  );
}
