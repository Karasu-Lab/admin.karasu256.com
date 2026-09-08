import type { NodeEnv } from '@Hashibutogarasu/types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: NodeEnv;
      NEXT_PUBLIC_ACCOUNTS_URL: string;
      ROOT_APP_URL: string;
      NEXT_PUBLIC_APP_URL: string;
      API_URL?: string;
    }
  }
}

export {};
