import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { withUi } from '@karasu-lab/ui/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3006'}/api/:path*`,
      },
    ];
  },
};

export default withUi(withNextIntl(nextConfig));
