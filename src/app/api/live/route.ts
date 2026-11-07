import { getSessionUser } from '@karasu-lab/utils/server';
import { listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getLiveFeed } from '@/lib/update-events';

export const runtime = 'nodejs';

const POLL_INTERVAL_MS = 2000;
const MAX_STREAM_MS = 25_000;

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) return new Response('Unauthorized', { status: 401 });
  const tenants = await listUserTenants(user.uid);
  const tenantId = new URL(request.url).searchParams.get('tenant') ?? undefined;
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) return new Response('Not found', { status: 404 });

  const encoder = new TextEncoder();
  let lastJson = '';
  let closed = false;
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
        }
      };
      const sendCurrent = async () => {
        if (closed) return;
        if (Date.now() - startedAt >= MAX_STREAM_MS) {
          finish();
          return;
        }
        try {
          const feed = await getLiveFeed(selected.id);
          if (closed) return;
          const json = JSON.stringify(feed);
          if (json !== lastJson) {
            lastJson = json;
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          } else {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          }
        } catch {
          finish();
        }
      };
      controller.enqueue(encoder.encode('retry: 1500\n\n'));
      const timer = setInterval(() => {
        void sendCurrent();
      }, POLL_INTERVAL_MS);
      void sendCurrent();
      request.signal.addEventListener('abort', finish);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
