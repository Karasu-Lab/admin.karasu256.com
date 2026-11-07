import 'server-only';
import { MissingEnvError, signRequest } from '@karasu-lab/utils/server';
import type { InstallationRepository, TenantOverview, TenantSummary } from './tenants';

function apiAuthBaseUrl(): string {
  const base = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_AUTH_API_URL;
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

async function apiAuthJson<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await apiAuthFetch(path, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`api-auth request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export async function listUserTenants(userId: string): Promise<TenantSummary[]> {
  const data = await apiAuthJson<{ tenants: TenantSummary[] }>(`/api/internal/users/${userId}/tenants`);
  return data.tenants;
}

export async function getTenantOverview(organizationId: string, userId: string): Promise<TenantOverview> {
  return apiAuthJson<TenantOverview>(`/api/internal/tenants/${organizationId}/overview?userId=${encodeURIComponent(userId)}`);
}

export async function listTenantRepositories(organizationId: string): Promise<InstallationRepository[]> {
  const data = await apiAuthJson<{ repositories: InstallationRepository[] }>(
    `/api/internal/tenants/${organizationId}/github-repositories`
  );
  return data.repositories;
}

export async function createTenantRepository(
  organizationId: string,
  body: { userId: string; name: string; description?: string; private?: boolean; isTemplate?: boolean }
): Promise<InstallationRepository> {
  const data = await apiAuthJson<{ repository: InstallationRepository }>(
    `/api/internal/tenants/${organizationId}/github-repositories`,
    { method: 'POST', body }
  );
  return data.repository;
}

export async function recordNpmConfiguration(
  organizationId: string,
  body: {
    userId: string;
    npmRepositoryId: number;
    npmRepositoryFullName: string;
    workflowTemplateRepositoryId: number;
    workflowTemplateRepositoryFullName: string;
  }
): Promise<void> {
  await apiAuthJson(`/api/internal/tenants/${organizationId}/npm-configuration`, { method: 'POST', body });
}

export async function linkTenantPackage(
  organizationId: string,
  body: {
    userId: string;
    repositoryId: number;
    repositoryFullName: string;
    submodulePath: string;
    versionNaming: string;
  }
): Promise<void> {
  await apiAuthJson(`/api/internal/tenants/${organizationId}/packages`, { method: 'POST', body });
}

export async function setTenantPackageEnabled(
  organizationId: string,
  packageId: string,
  body: { userId: string; enabled: boolean }
): Promise<void> {
  await apiAuthJson(`/api/internal/tenants/${organizationId}/packages/${packageId}/enabled`, { method: 'POST', body });
}

export async function getInstallationToken(organizationId: string): Promise<{ token: string; expiresAt: string }> {
  return apiAuthJson(`/api/internal/tenants/${organizationId}/github-installation-token`, { method: 'POST', body: {} });
}

export async function createBotPullRequest(body: {
  organizationId: string;
  repositoryFullName: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  enableAutoMerge?: boolean;
}): Promise<{ number: number; url: string; autoMergeEnabled: boolean }> {
  const data = await apiAuthJson<{ pullRequest: { number: number; url: string; autoMergeEnabled: boolean } }>(
    '/api/internal/github/pulls',
    { method: 'POST', body }
  );
  return data.pullRequest;
}

export async function updateLinkedPackagePointer(organizationId: string, packageId: string, sha: string): Promise<void> {
  await apiAuthJson(`/api/internal/tenants/${organizationId}/packages/${packageId}/pointer`, {
    method: 'POST',
    body: { sha },
  });
}

export interface PushWebhookDecision {
  accepted: boolean;
  reason?: string;
  organizationId?: string;
  installationId?: number;
  package?: { id: string; repositoryFullName: string; submodulePath: string; lastSyncedSha: string | null };
  npmRepositoryFullName?: string;
  signingKeyOwner?: { name: string | null; email: string | null } | null;
}

export async function evaluatePushWebhook(body: {
  installationId: number;
  repositoryFullName: string;
  afterSha: string;
}): Promise<PushWebhookDecision> {
  return apiAuthJson<PushWebhookDecision>('/api/internal/webhooks/push', { method: 'POST', body });
}
