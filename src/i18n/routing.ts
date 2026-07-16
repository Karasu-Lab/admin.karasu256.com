import { defineRouting } from 'next-intl/routing';
import type { Locale } from '@Hashibutogarasu/types';

export const routing = defineRouting({
  locales: ['en', 'ja'] satisfies Locale[],
  defaultLocale: 'en',
  localePrefix: 'never',
});
