import { getLocale, getTranslations } from 'next-intl/server';
import { Header as UiHeader, type CountryCode } from '@karasu-lab/ui';
import { getSessionUser, getSignInUrl, signOutAction, setLocaleAction } from '@karasu-lab/utils/server';
import { listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import type { TenantSummary } from '@/lib/tenants';
import { HeaderTitle } from './header-title';
import { TenantAccountMenu } from './tenant-account-menu';

const localeLabels: Record<'en' | 'ja', { label: string; countryCode: CountryCode }> = {
  en: { label: 'English', countryCode: 'US' },
  ja: { label: '日本語', countryCode: 'JP' },
};

export async function Header() {
  const clientConfig = getClientConfig();
  const signInUrl = await getSignInUrl(clientConfig.authUrl);
  const t = await getTranslations('header');
  const currentLocale = await getLocale();
  const user = await getSessionUser(clientConfig.authApiUrl);
  let tenants: TenantSummary[] = [];
  if (user) {
    try {
      tenants = await listUserTenants(user.uid);
    } catch {
      tenants = [];
    }
  }

  return (
    <UiHeader
      logo={<HeaderTitle />}
      locales={localeLabels}
      currentLocale={currentLocale}
      onLocaleChange={setLocaleAction}
    >
      <TenantAccountMenu
        tenants={tenants}
        authApiUrl={clientConfig.authApiUrl}
        signInHref={signInUrl}
        settingsHref={tenants[0] ? `${clientConfig.appUrl}/tenants/${tenants[0].id}/settings` : undefined}
        onSignOut={signOutAction}
        labels={{ signIn: t('signIn'), settings: t('settings'), signOut: t('signOut') }}
        triggerAriaLabel={t('accountMenuLabel')}
      />
    </UiHeader>
  );
}
