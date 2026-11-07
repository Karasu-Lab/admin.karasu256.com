import { z } from 'zod';

const clientConfigSchema = z.object({
  authApiUrl: z.string().url(),
  authUrl: z.string().url(),
  appUrl: z.string().url(),
  gitApiUrl: z.string().url(),
});

export type ClientConfig = z.infer<typeof clientConfigSchema>;

export function getClientConfig(): ClientConfig {
  return clientConfigSchema.parse({
    authApiUrl: process.env.AUTH_API_URL,
    authUrl: process.env.AUTH_URL,
    appUrl: process.env.APP_URL,
    gitApiUrl: process.env.GIT_API_URL,
  });
}
