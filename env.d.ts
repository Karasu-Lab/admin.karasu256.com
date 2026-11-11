import type { NodeEnv } from '@karasu-lab/types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: NodeEnv;
      APP_ENV?: string;
      AUTH_URL: string;
      AUTH_API_URL: string;
      APP_URL: string;
      GIT_API_URL: string;
      ROOT_APP_URL: string;
      INTERNAL_API_SECRET?: string;
      GH_APP_WEBHOOK_SECRET?: string;
      BETTER_AUTH_SECRET?: string;
    }
  }
}

export {};
