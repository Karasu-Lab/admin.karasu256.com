import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { withUi } from '@karasu-lab/ui/next';

class SecurityHeaders {
  source = '/:path*';
  headers = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  ];

  build() {
    return [{ source: this.source, headers: this.headers }];
  }
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async headers() {
    return new SecurityHeaders().build();
  },
};

export default withUi(withNextIntl(nextConfig));
