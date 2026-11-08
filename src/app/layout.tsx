import type { Metadata } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { PopUpMenuProvider, SessionProvider, Toaster, TooltipProvider } from '@karasu-lab/ui';
import { geistSans, geistMono, notoSansJP } from '@karasu-lab/ui/fonts';
import { getSessionUser } from '@karasu-lab/utils/server';
import { Header } from '@/components/header';
import { LoadingProvider } from '@/components/settings/loading-context';
import { getClientConfig } from '@/lib/client-config';
import { GithubCorner } from '@/components/github-corner';
import { NavSidebar } from '@/components/nav-sidebar';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: t('title'),
    icons: {
      icon: '/icons/kara_su.png',
      shortcut: '/icons/kara_su.png',
      apple: '/icons/kara_su.png',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const clientConfig = getClientConfig();
  const sessionUser = await getSessionUser(clientConfig.authApiUrl);
  const initialUser = sessionUser
    ? { uid: sessionUser.uid, iconUrl: sessionUser.image, displayName: sessionUser.name, email: sessionUser.email }
    : null;

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider baseURL={clientConfig.authApiUrl} initialUser={initialUser}>
            <PopUpMenuProvider>
              <TooltipProvider>
                <LoadingProvider>
                  <Header />
                  <div className="flex w-full flex-1 flex-col md:flex-row">
                    <NavSidebar />
                    <main className="min-w-0 flex-1">{children}</main>
                  </div>
                  <GithubCorner />
                </LoadingProvider>
              </TooltipProvider>
            </PopUpMenuProvider>
            <Toaster />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
