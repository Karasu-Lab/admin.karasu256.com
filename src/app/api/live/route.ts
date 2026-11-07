import { getSessionUser } from '@karasu-lab/utils/server';
import { listUserTenants } from '@/lib/api-auth';
import { getClientConfig } from '@/lib/client-config';
import { getLiveFeed } from '@/lib/update-events';

export const runtime = 'nodejs';

const POLL_INTERVAL_MS = 3000;
const HEARTBEAT_EVERY_TICKS = 5;

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser(getClientConfig().authApiUrl);
  if (!user) return new Response('Unauthorized', { status: 401 });
  const tenants = await listUserTenants(user.uid);
  const tenantId = new URL(request.url).searchParams.get('tenant') ?? undefined;
  const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
  if (!selected) return new Response('Not found', { status: 404 });

  const encoder = new TextEncoder();
  let lastJson = '';
  let ticks = 0;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendCurrent = async () => {
        if (closed) return;
        try {
          const feed = await getLiveFeed(selected.id);
          const json = JSON.stringify(feed);
          ticks += 1;
          if (json !== lastJson) {
            lastJson = json;
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          } else if (ticks % HEARTBEAT_EVERY_TICKS === 0) {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          }
        } catch {
          closed = true;
          clearInterval(timer);
          try {
            controller.close();
          } catch {
          }
        }
      };
      const timer = setInterval(() => {
        void sendCurrent();
      }, POLL_INTERVAL_MS);
      void sendCurrent();
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
        }
      });
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
