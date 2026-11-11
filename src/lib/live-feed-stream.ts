import 'server-only';
import { log } from '@karasu-lab/utils/server';
import { listUserTenants } from './api-auth';
import { TenantAccess } from './tenant-access';
import { PackageUpdateEvents } from './update-events';

export class LiveFeedStream {
  pollIntervalMs = 2000;
  maxStreamMs = 25_000;
  retryMs = 1500;
  updates = new PackageUpdateEvents();
  access = new TenantAccess();

  async respond(request: Request): Promise<Response> {
    const userId = await this.access.optionalUserId();
    if (!userId) return new Response('Unauthorized', { status: 401 });
    const tenants = await listUserTenants(userId);
    const tenantId = new URL(request.url).searchParams.get('tenant') ?? undefined;
    const selected = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;
    if (!selected) return new Response('Not found', { status: 404 });

    const encoder = new TextEncoder();
    let lastJson = '';
    let closed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const startedAt = Date.now();

    const stream = new ReadableStream<Uint8Array>({
      cancel: () => {
        closed = true;
        clearInterval(timer);
      },
      start: (controller) => {
        const finish = () => {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          controller.close();
        };
        const sendCurrent = async () => {
          if (closed) return;
          if (Date.now() - startedAt >= this.maxStreamMs) {
            finish();
            return;
          }
          try {
            const json = JSON.stringify(await this.updates.liveFeed(selected.id));
            if (closed) return;
            controller.enqueue(encoder.encode(json !== lastJson ? `data: ${json}\n\n` : ': heartbeat\n\n'));
            lastJson = json;
          } catch (caught) {
            log('live_feed_failed', { organizationId: selected.id, message: caught instanceof Error ? caught.message : String(caught) }, 'error');
            finish();
          }
        };
        controller.enqueue(encoder.encode(`retry: ${this.retryMs}\n\n`));
        timer = setInterval(() => {
          void sendCurrent();
        }, this.pollIntervalMs);
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
}
