import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { withUi } from '@karasu-lab/ui/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = process.env.API_URL;
if (!apiUrl) throw new Error('Missing required environment variable: API_URL');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default withUi(withNextIntl(nextConfig));
