import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Header as UiHeader, AccountMenu, type CountryCode } from '@Hashibutogarasu/ui';
import { getRootAppUrl, signOutAction, setLocaleAction } from '@Hashibutogarasu/utils/server';
import { VercelConnectionStore } from '@/lib/vercel';
import { VercelConnectButton } from './vercel-connect-button';

const localeLabels: Record<'en' | 'ja', { label: string; countryCode: CountryCode }> = {
  en: { label: 'English', countryCode: 'US' },
  ja: { label: '日本語', countryCode: 'JP' },
};

/**
 * Site-wide header. Shows an account menu (driven by the nearest
 * `SessionProvider`, see the root layout) when authenticated, or a sign-in
 * button when not, plus a language switcher.
 */
export async function Header() {
  const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL;
  const rootUrl = await getRootAppUrl();
  const t = await getTranslations('header');
  const currentLocale = await getLocale();
  const vercelConnection = await new VercelConnectionStore().get();

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
      <VercelConnectButton connected={vercelConnection !== null} connectLabel={t('connectVercel')} connectedLabel={t('vercelConnected')} />
      <AccountMenu
        signInHref={accountsUrl}
        settingsHref={`${rootUrl}/settings`}
        onSignOut={signOutAction}
        labels={{ signIn: t('signIn'), settings: t('settings'), signOut: t('signOut') }}
        triggerAriaLabel={t('accountMenuLabel')}
      />
    </UiHeader>
  );
}
