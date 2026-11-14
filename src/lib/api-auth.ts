import 'server-only';
import { z } from 'zod';
import {
  assignTenantTypeRequestSchema,
  assignTenantTypeResponseSchema,
  type AssignTenantTypeRequest,
  type AssignTenantTypeResponse,
} from '@karasu-lab/types/shared';
import { MissingEnvError, signRequest } from '@karasu-lab/utils/server';
import { GithubIdentifiers } from './github-identifiers';
import { tenantOverviewSchema, tenantSummarySchema, type TenantOverview, type TenantSummary } from './tenants';

export function pushWebhookDecisionSchema() {
  return z.object({
    accepted: z.boolean(),
    reason: z.string().optional(),
    organizationId: z.string().optional(),
    installationId: z.number().optional(),
    package: z
      .object({
        id: z.string(),
        repositoryFullName: z.string(),
        submodulePath: z.string(),
        lastSyncedSha: z.string().nullable(),
      })
      .optional(),
  });
}

export type PushWebhookDecision = z.infer<ReturnType<typeof pushWebhookDecisionSchema>>;

export function installationWebhookResultSchema() {
  return z.object({
    accepted: z.boolean(),
    reason: z.string().optional(),
    organizationId: z.string().optional(),
    action: z.string().optional(),
  });
}

export type InstallationWebhookResult = z.infer<ReturnType<typeof installationWebhookResultSchema>>;

export function installationTokenSchema() {
  return z.object({ token: z.string(), expiresAt: z.string() });
}

export type InstallationToken = z.infer<ReturnType<typeof installationTokenSchema>>;

export function linkTenantPackageBodySchema() {
  return z.object({
    userId: z.string(),
    repositoryId: z.number(),
    repositoryFullName: z.string(),
    submodulePath: z.string(),
    versionNaming: z.string(),
  });
}

export type LinkTenantPackageBody = z.infer<ReturnType<typeof linkTenantPackageBodySchema>>;

function apiAuthBaseUrl(): string {
  const base = process.env.AUTH_API_URL;
  if (!base) throw new MissingEnvError('AUTH_API_URL');
  return base.replace(/\/+$/, '');
}

export async function apiAuthFetch(path: string, init?: { method?: string; body?: unknown }): Promise<Response> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new MissingEnvError('INTERNAL_API_SECRET');
  const method = init?.method ?? 'GET';
  const url = `${apiAuthBaseUrl()}${path}`;
  const body = init?.body !== undefined ? JSON.stringify(init.body) : undefined;
  return fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...signRequest({ secret, method, url, body: body ?? '' }),
    },
    body,
    cache: 'no-store',
  });
}

async function apiAuthJson<T>(path: string, schema: z.ZodType<T>, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await apiAuthFetch(path, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`api-auth request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return schema.parse(await response.json());
}

function tenantPath(organizationId: string): string {
  return `/api/internal/tenants/${encodeURIComponent(new GithubIdentifiers().assertOpaqueId(organizationId))}`;
}

function packagePath(organizationId: string, packageId: string): string {
  return `${tenantPath(organizationId)}/packages/${encodeURIComponent(new GithubIdentifiers().assertOpaqueId(packageId))}`;
}

export async function listUserTenants(userId: string): Promise<TenantSummary[]> {
  const data = await apiAuthJson(
    `/api/internal/users/${encodeURIComponent(new GithubIdentifiers().assertOpaqueId(userId))}/tenants`,
    z.object({ tenants: z.array(tenantSummarySchema()) })
  );
  return data.tenants;
}

export async function getGithubAppInstallUrl(): Promise<string> {
  const data = await apiAuthJson('/api/internal/github-app/install-url', z.object({ installUrl: z.string() }));
  return data.installUrl;
}

export async function getTenantOverview(organizationId: string, userId: string): Promise<TenantOverview> {
  return apiAuthJson(`${tenantPath(organizationId)}/overview?userId=${encodeURIComponent(userId)}`, tenantOverviewSchema());
}

export async function assignTenantType(organizationId: string, body: AssignTenantTypeRequest): Promise<AssignTenantTypeResponse> {
  return apiAuthJson(`${tenantPath(organizationId)}/type`, assignTenantTypeResponseSchema, {
    method: 'POST',
    body: assignTenantTypeRequestSchema.parse(body),
  });
}

export async function getTenantInstallationId(organizationId: string): Promise<number | null> {
  const data = await apiAuthJson(
    `${tenantPath(organizationId)}/github-installation`,
    z.object({ installation: z.object({ installationId: z.number() }).nullable() })
  );
  return data.installation?.installationId ?? null;
}

export async function linkTenantPackage(organizationId: string, body: LinkTenantPackageBody): Promise<void> {
  await apiAuthJson(`${tenantPath(organizationId)}/packages`, z.unknown(), {
    method: 'POST',
    body: linkTenantPackageBodySchema().parse(body),
  });
}

export async function setTenantPackageEnabled(
  organizationId: string,
  packageId: string,
  body: { userId: string; enabled: boolean }
): Promise<void> {
  await apiAuthJson(`${packagePath(organizationId, packageId)}/enabled`, z.unknown(), { method: 'POST', body });
}

export async function unlinkTenantPackage(organizationId: string, packageId: string, body: { userId: string }): Promise<void> {
  await apiAuthJson(packagePath(organizationId, packageId), z.unknown(), { method: 'DELETE', body });
}

export async function uninstallTenantBot(organizationId: string, body: { userId: string }): Promise<void> {
  await apiAuthJson(`${tenantPath(organizationId)}/github-installation`, z.unknown(), { method: 'DELETE', body });
}

export async function getInstallationToken(organizationId: string): Promise<InstallationToken> {
  return apiAuthJson(`${tenantPath(organizationId)}/github-installation-token`, installationTokenSchema(), {
    method: 'POST',
    body: {},
  });
}

export async function updateLinkedPackagePointer(organizationId: string, packageId: string, sha: string): Promise<void> {
  await apiAuthJson(`${packagePath(organizationId, packageId)}/pointer`, z.unknown(), {
    method: 'POST',
    body: { sha },
  });
}

export async function evaluatePushWebhook(body: {
  installationId: number;
  repositoryFullName: string;
  afterSha: string;
}): Promise<PushWebhookDecision> {
  return apiAuthJson('/api/internal/webhooks/push', pushWebhookDecisionSchema(), { method: 'POST', body });
}

export async function applyInstallationWebhook(body: {
  installationId: number;
  action: string;
}): Promise<InstallationWebhookResult> {
  return apiAuthJson('/api/internal/webhooks/installation', installationWebhookResultSchema(), { method: 'POST', body });
}
