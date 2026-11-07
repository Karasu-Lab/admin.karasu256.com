import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@karasu-lab/ui';
import { getSessionUser } from '@karasu-lab/utils/server';
import { NavSidebar } from '@/components/nav-sidebar';
import { LinkedPackagesSection } from '@/components/linked-packages-section';
import { SigningKeysSection } from '@/components/signing-keys-section';
import { getTenantOverview } from '@/lib/api-auth';
import type { TenantOverview } from '@/lib/tenants';

export default async function TenantSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('TenantSettings');
  const user = await getSessionUser(process.env.NEXT_PUBLIC_AUTH_API_URL);
  const authApiUrl = process.env.NEXT_PUBLIC_AUTH_API_URL;
  const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${id}/settings`;

  let overview: TenantOverview | null = null;
  let loadError: string | null = null;
  if (user) {
    try {
      overview = await getTenantOverview(id, user.uid);
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  } else {
    loadError = 'unauthorized';
  }

  const installUrl = `${authApiUrl}/api/github-app/install?organizationId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(settingsUrl)}`;

  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">
          {t('title')}
          {overview ? ` — ${overview.organization.name}` : ''}
        </h1>
        {loadError && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {t('loadError')}: {loadError}
              </p>
            </CardContent>
          </Card>
        )}
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
                {overview.npmConfiguration ? (
                  <>
                    <p className="text-sm">
                      {t('npmRepository')}: {overview.npmConfiguration.npmRepositoryFullName}
                    </p>
                    <p className="text-sm">
                      {t('templateRepository')}: {overview.npmConfiguration.workflowTemplateRepositoryFullName}
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
            <SigningKeysSection
              organizationId={id}
              authApiUrl={authApiUrl}
              settingsUrl={settingsUrl}
              keys={overview.signingKeys}
            />
          </>
        )}
      </main>
    </div>
  );
}
