import { GithubWebhookHandler } from '@/lib/github-webhook-handler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return new GithubWebhookHandler().handle(request);
}
