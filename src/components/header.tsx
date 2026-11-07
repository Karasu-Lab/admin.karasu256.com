import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Header as UiHeader, AccountMenu, type CountryCode } from '@karasu-lab/ui';
import { getRootAppUrl, getSessionUser, getSignInUrl, signOutAction, setLocaleAction } from '@karasu-lab/utils/server';
import { listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import type { TenantSummary } from '@/lib/tenants';
import { TenantMenuSection } from './tenant-menu-section';

const localeLabels: Record<'en' | 'ja', { label: string; countryCode: CountryCode }> = {
  en: { label: 'English', countryCode: 'US' },
  ja: { label: '日本語', countryCode: 'JP' },
};

export async function Header() {
  const clientConfig = getClientConfig();
  const signInUrl = await getSignInUrl(clientConfig.authUrl);
  const rootUrl = await getRootAppUrl();
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
      logo={
        <Link href="/" className="hover:text-gray-600 transition-colors">
          Karasu Lab Admin
        </Link>
      }
      locales={localeLabels}
      currentLocale={currentLocale}
      onLocaleChange={setLocaleAction}
    >
      <AccountMenu
        signInHref={signInUrl}
        settingsHref={`${rootUrl}/settings`}
        onSignOut={signOutAction}
        labels={{ signIn: t('signIn'), settings: t('settings'), signOut: t('signOut') }}
        triggerAriaLabel={t('accountMenuLabel')}
      >
        {user ? <TenantMenuSection tenants={tenants} authApiUrl={clientConfig.authApiUrl} /> : null}
      </AccountMenu>
    </UiHeader>
  );
}
