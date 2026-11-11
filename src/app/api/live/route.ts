import { LiveFeedStream } from '@/lib/live-feed-stream';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return new LiveFeedStream().respond(request);
}
