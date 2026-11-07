import { createHmac, timingSafeEqual } from 'node:crypto';
import { githubPushWebhookPayloadSchema } from '@karasu-lab/types/shared';
import { evaluatePushWebhook } from '@/lib/api-auth';
import { getTenantNpmRepository } from '@/lib/npm-repository';
import { runPointerUpdate } from '@/lib/webhook-automation';

export const runtime = 'nodejs';

function defaultBranchOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const repository = (payload as { repository?: unknown }).repository;
  if (typeof repository !== 'object' || repository === null) return null;
  const branch = (repository as { default_branch?: unknown }).default_branch;
  return typeof branch === 'string' ? branch : null;
}

function signatureValid(secret: string, body: string, header: string | null): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.GH_APP_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  const body = await request.text();
  if (!signatureValid(secret, body, request.headers.get('x-hub-signature-256'))) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const event = request.headers.get('x-github-event');
  if (event !== 'push') return Response.json({ accepted: false, reason: 'event_ignored' }, { status: 202 });
  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(body);
  } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const parsed = githubPushWebhookPayloadSchema.safeParse(payloadJson);
  if (!parsed.success) return Response.json({ error: 'invalid_payload' }, { status: 400 });
  const defaultBranch = defaultBranchOf(payloadJson);
  if (defaultBranch && parsed.data.ref !== `refs/heads/${defaultBranch}`) {
    return Response.json({ accepted: false, reason: 'not_default_branch' }, { status: 202 });
  }
  const decision = await evaluatePushWebhook({
    installationId: parsed.data.installation.id,
    repositoryFullName: parsed.data.repository.full_name,
    afterSha: parsed.data.after,
  });
  if (!decision.accepted || !decision.organizationId) {
    return Response.json({ accepted: false, reason: decision.reason ?? 'not_accepted' }, { status: 202 });
  }
  let npmRepository;
  try {
    npmRepository = await getTenantNpmRepository(decision.organizationId);
  } catch (error) {
    return Response.json(
      { accepted: false, reason: `npm_repository_lookup_failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 202 }
    );
  }
  if (!npmRepository?.npmRepositoryFullName) {
    return Response.json({ accepted: false, reason: 'npm_not_configured' }, { status: 202 });
  }
  const result = await runPointerUpdate({ ...decision, accepted: true }, npmRepository, parsed.data.after);
  return Response.json(result, { status: 202 });
}
