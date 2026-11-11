import 'server-only';
import { z } from 'zod';
import { log } from '@karasu-lab/utils/server';
import { claimDedupeKey, releaseDedupeKey } from './admin-db';
import { applyInstallationWebhook, evaluatePushWebhook, getTenantInstallationId } from './api-auth';
import { GithubIdentifiers } from './github-identifiers';
import { githubWebhookEventSchema, GithubWebhookPayloads } from './github-webhook';
import { getTenantNpmRepository } from './npm-repository';
import { PointerUpdateFlow } from './pointer-update';
import { PublishWorkflowRunHandler } from './publish-workflow-run';
import { GithubWebhookSignature } from './webhook-signature';
import { WebhookSecrets } from './webhook-secret';

export function webhookErrorSchema() {
  return z.enum(['webhook_not_configured', 'invalid_signature', 'invalid_payload', 'payload_too_large']);
}

export function webhookIgnoredReasonSchema() {
  return z.enum(['event_ignored', 'default_branch_missing', 'not_default_branch', 'branch_deleted', 'not_accepted', 'npm_not_configured', 'npm_repository_lookup_failed']);
}

export function webhookContextSchema() {
  return z.object({ deliveryId: z.string().nullable(), routedOrganizationId: z.string().nullable() });
}

export type WebhookContext = z.infer<ReturnType<typeof webhookContextSchema>>;

type WebhookRoute = (payload: unknown, context: WebhookContext) => Promise<Response>;

export class GithubWebhookHandler {
  maxBodyBytes = 5 * 1024 * 1024;
  deliveryRetentionMs = 7 * 24 * 60 * 60 * 1000;
  deliveryKeyPrefix = 'github-delivery';
  serverErrorStatus = 500;
  zeroSha = '0'.repeat(40);
  signature = new GithubWebhookSignature();
  secrets = new WebhookSecrets();
  payloads = new GithubWebhookPayloads();
  identifiers = new GithubIdentifiers();
  pointerUpdate = new PointerUpdateFlow();
  workflowRuns = new PublishWorkflowRunHandler();
  events = githubWebhookEventSchema().enum;
  errors = webhookErrorSchema().enum;
  ignored = webhookIgnoredReasonSchema().enum;
  routes = new Map<string, WebhookRoute>([
    [this.events.push, (payload, context) => this.handlePush(payload, context)],
    [this.events.installation, (payload, context) => this.handleInstallation(payload, context)],
    [this.events.workflow_run, (payload, context) => this.handleWorkflowRun(payload, context)],
  ]);

  private messageOf(caught: unknown): string {
    return caught instanceof Error ? caught.message : String(caught);
  }

  private error(error: z.infer<ReturnType<typeof webhookErrorSchema>>, status: number): Response {
    return Response.json({ error }, { status });
  }

  private ignore(reason: z.infer<ReturnType<typeof webhookIgnoredReasonSchema>>): Response {
    return Response.json({ accepted: false, reason }, { status: 202 });
  }

  private rejectTenantMismatch(detail: Record<string, unknown>): Response {
    log('github_webhook_failed', { reason: this.errors.invalid_signature, detail: 'tenant_route_mismatch', ...detail }, 'error');
    return this.error(this.errors.invalid_signature, 401);
  }

  private async handleInstallation(payload: unknown, context: WebhookContext): Promise<Response> {
    const parsed = this.payloads.installation(payload);
    if (!parsed.success) return this.error(this.errors.invalid_payload, 400);
    const installationId = parsed.data.installation.id;
    if (context.routedOrganizationId) {
      const owned = await getTenantInstallationId(context.routedOrganizationId);
      if (owned !== installationId) {
        return this.rejectTenantMismatch({ deliveryId: context.deliveryId, routedOrganizationId: context.routedOrganizationId });
      }
    }
    const result = await applyInstallationWebhook({ installationId, action: parsed.data.action });
    if (!result.accepted) {
      log('github_webhook_failed', { reason: result.reason ?? 'installation_not_accepted', deliveryId: context.deliveryId, installationId }, 'error');
    }
    return Response.json(result, { status: 202 });
  }

  private async handlePush(payload: unknown, context: WebhookContext): Promise<Response> {
    const parsed = this.payloads.push(payload);
    if (!parsed.success) return this.error(this.errors.invalid_payload, 400);
    const push = parsed.data;
    if (!this.identifiers.isCommitSha(push.after)) return this.error(this.errors.invalid_payload, 400);
    const defaultBranch = push.repository.default_branch;
    if (!defaultBranch) return this.ignore(this.ignored.default_branch_missing);
    if (push.ref !== `refs/heads/${defaultBranch}`) return this.ignore(this.ignored.not_default_branch);
    if (push.after === this.zeroSha) return this.ignore(this.ignored.branch_deleted);

    const decision = await evaluatePushWebhook({
      installationId: push.installation.id,
      repositoryFullName: push.repository.full_name,
      afterSha: push.after,
    });
    if (context.routedOrganizationId && decision.organizationId && decision.organizationId !== context.routedOrganizationId) {
      return this.rejectTenantMismatch({
        deliveryId: context.deliveryId,
        routedOrganizationId: context.routedOrganizationId,
        organizationId: decision.organizationId,
      });
    }
    if (!decision.accepted || !decision.organizationId || !decision.package) {
      log(
        'github_webhook_failed',
        { reason: decision.reason ?? this.ignored.not_accepted, deliveryId: context.deliveryId, repositoryFullName: push.repository.full_name },
        'error'
      );
      return Response.json(
        { accepted: false, reason: context.routedOrganizationId ? this.ignored.not_accepted : (decision.reason ?? this.ignored.not_accepted) },
        { status: 202 }
      );
    }

    let npmRepository;
    try {
      npmRepository = await getTenantNpmRepository(decision.organizationId);
    } catch (caught) {
      log(
        'github_webhook_failed',
        { reason: this.ignored.npm_repository_lookup_failed, deliveryId: context.deliveryId, organizationId: decision.organizationId, message: this.messageOf(caught) },
        'error'
      );
      return this.ignore(this.ignored.npm_repository_lookup_failed);
    }
    if (!npmRepository?.npmRepositoryFullName) return this.ignore(this.ignored.npm_not_configured);

    const started = await this.pointerUpdate.start({
      organizationId: decision.organizationId,
      package: decision.package,
      npmRepositoryFullName: npmRepository.npmRepositoryFullName,
      afterSha: push.after,
    });
    return Response.json({ accepted: started.dispatched, reason: started.reason }, { status: 202 });
  }

  private async handleWorkflowRun(payload: unknown, context: WebhookContext): Promise<Response> {
    const parsed = this.payloads.workflowRun(payload);
    if (!parsed.success) return this.error(this.errors.invalid_payload, 400);
    const result = await this.workflowRuns.handle(parsed.data, context.routedOrganizationId);
    if (result.unauthorized) return this.rejectTenantMismatch({ deliveryId: context.deliveryId });
    return Response.json(result, { status: 202 });
  }

  private matchRoutedOrganization(secretsByTenant: { organizationId: string; secret: string }[], body: string, header: string | null) {
    return secretsByTenant.find(({ secret }) => this.signature.isValid(secret, body, header)) ?? null;
  }

  async handle(request: Request): Promise<Response> {
    if (Number(request.headers.get('content-length') ?? '0') > this.maxBodyBytes) {
      return this.error(this.errors.payload_too_large, 413);
    }
    const body = await request.text();
    const event = request.headers.get('x-github-event') ?? '';
    const deliveryId = request.headers.get('x-github-delivery');
    const masterSecret = this.secrets.master();
    const tenantSecrets = await this.secrets.listTenantSecrets().catch((caught) => {
      log('github_webhook_failed', { reason: 'tenant_secrets_load_failed', event, deliveryId, message: this.messageOf(caught) }, 'error');
      return [];
    });
    if (!masterSecret && tenantSecrets.length === 0) return this.error(this.errors.webhook_not_configured, 503);

    const signatureHeader = request.headers.get('x-hub-signature-256');
    const matchedByMaster = masterSecret !== null && this.signature.isValid(masterSecret, body, signatureHeader);
    const matchedTenant = this.matchRoutedOrganization(tenantSecrets, body, signatureHeader);
    if (!matchedByMaster && !matchedTenant) {
      log('github_webhook_failed', { reason: this.errors.invalid_signature, event, deliveryId }, 'error');
      return this.error(this.errors.invalid_signature, 401);
    }

    const route = this.routes.get(event);
    if (!route) return this.ignore(this.ignored.event_ignored);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return this.error(this.errors.invalid_payload, 400);
    }

    const deliveryKey = deliveryId ? `${this.deliveryKeyPrefix}:${deliveryId}` : null;
    if (deliveryKey && !(await claimDedupeKey(deliveryKey, this.deliveryRetentionMs))) {
      return Response.json({ accepted: true, duplicate: true }, { status: 202 });
    }
    try {
      const response = await route(payload, { deliveryId, routedOrganizationId: matchedTenant?.organizationId ?? null });
      if (deliveryKey && response.status >= this.serverErrorStatus) await releaseDedupeKey(deliveryKey);
      return response;
    } catch (caught) {
      if (deliveryKey) await releaseDedupeKey(deliveryKey);
      throw caught;
    }
  }
}
