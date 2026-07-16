import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const LOCALE_HEADER = 'X-NEXT-INTL-LOCALE';

type SupportedLocale = (typeof routing.locales)[number];

function parseAcceptLanguage(header: string): SupportedLocale | undefined {
  const entries = header
    .split(',')
    .map((entry) => {
      const [tag, q] = entry.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    const match = routing.locales.find((l) => tag === l.toLowerCase() || tag.startsWith(l.toLowerCase() + '-'));
    if (match) return match;
  }
  return undefined;
}

function resolveLocale(request: NextRequest): SupportedLocale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && (routing.locales as readonly string[]).includes(cookie)) {
    return cookie as SupportedLocale;
  }

  const acceptLanguage = request.headers.get('Accept-Language') ?? '';
  return parseAcceptLanguage(acceptLanguage) ?? routing.defaultLocale;
}

export default function middleware(request: NextRequest) {
  const locale = resolveLocale(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!request.cookies.has(LOCALE_COOKIE)) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
