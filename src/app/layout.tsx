import type { Metadata } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { PopUpMenuProvider, SessionProvider, TooltipProvider } from '@Hashibutogarasu/ui';
import { geistSans, geistMono, notoSansJP } from '@Hashibutogarasu/ui/fonts';
import { getSessionUser } from '@Hashibutogarasu/utils/server';
import { Header } from '@/components/header';
import { GithubCorner } from '@/components/github-corner';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('title') };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const sessionUser = await getSessionUser(process.env.NEXT_PUBLIC_ACCOUNTS_URL);
  const initialUser = sessionUser
    ? { uid: sessionUser.uid, iconUrl: sessionUser.image, displayName: sessionUser.name, email: sessionUser.email }
    : null;

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider baseURL={process.env.NEXT_PUBLIC_ACCOUNTS_URL} initialUser={initialUser}>
            <PopUpMenuProvider>
              <TooltipProvider>
                <Header />
                <main className="flex flex-1">{children}</main>
                <GithubCorner />
              </TooltipProvider>
            </PopUpMenuProvider>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
