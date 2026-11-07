import type { NodeEnv } from '@karasu-lab/types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: NodeEnv;
      NEXT_PUBLIC_AUTH_URL: string;
      NEXT_PUBLIC_AUTH_API_URL: string;
      ROOT_APP_URL: string;
      NEXT_PUBLIC_APP_URL: string;
      AUTH_API_URL?: string;
      INTERNAL_API_SECRET?: string;
      GITHUB_APP_WEBHOOK_SECRET?: string;
      COMMIT_SIGNING_PRIVATE_KEY?: string;
    }
  }
}

export {};
