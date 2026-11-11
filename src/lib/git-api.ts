import 'server-only';
import { z } from 'zod';
import { MissingEnvError, signRequest } from '@karasu-lab/utils/server';
import { getClientConfig } from './client-config';
import { installationRepositorySchema, type InstallationRepository } from './tenants';

export function commitContentsInputSchema() {
  return z.object({
    organizationId: z.string(),
    repositoryFullName: z.string(),
    branch: z.string(),
    baseBranch: z.string(),
    message: z.string(),
    files: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
    deletions: z.array(z.string()).optional(),
  });
}

export type CommitContentsInput = z.infer<ReturnType<typeof commitContentsInputSchema>>;

export function commitContentsResultSchema() {
  return z.discriminatedUnion('outcome', [
    z.object({ outcome: z.literal('pushed'), commitOid: z.string(), branch: z.string() }),
    z.object({ outcome: z.literal('no_changes'), branch: z.string() }),
  ]);
}

export type CommitContentsResult = z.infer<ReturnType<typeof commitContentsResultSchema>>;

export function repositoryDispatchEventTypeSchema() {
  return z.enum(['pointer-update', 'link-package', 'unlink-package']);
}

export type RepositoryDispatchEventType = z.infer<ReturnType<typeof repositoryDispatchEventTypeSchema>>;

export function repositoryDispatchInputSchema() {
  return z.object({
    organizationId: z.string(),
    repositoryFullName: z.string(),
    eventType: repositoryDispatchEventTypeSchema(),
    clientPayload: z.record(z.string(), z.union([z.string(), z.number()])),
  });
}

export type RepositoryDispatchInput = z.infer<ReturnType<typeof repositoryDispatchInputSchema>>;

export function createRepositoryInputSchema() {
  return z.object({
    organizationId: z.string(),
    targetType: z.enum(['Organization', 'User']),
    targetLogin: z.string(),
    name: z.string(),
    description: z.string().optional(),
    private: z.boolean().optional(),
    isTemplate: z.boolean().optional(),
  });
}

export type CreateRepositoryInput = z.infer<ReturnType<typeof createRepositoryInputSchema>>;

export function pullRequestInputSchema() {
  return z.object({
    organizationId: z.string(),
    repositoryFullName: z.string(),
    title: z.string(),
    head: z.string(),
    base: z.string(),
    body: z.string().optional(),
    enableAutoMerge: z.boolean().optional(),
  });
}

export type PullRequestInput = z.infer<ReturnType<typeof pullRequestInputSchema>>;

export function pullRequestSchema() {
  return z.object({ number: z.number(), url: z.string(), autoMergeEnabled: z.boolean() });
}

export type BotPullRequest = z.infer<ReturnType<typeof pullRequestSchema>>;

export function mergedPullRequestSchema() {
  return z.object({ number: z.number(), url: z.string(), headRef: z.string(), headSha: z.string() });
}

export type MergedPullRequest = z.infer<ReturnType<typeof mergedPullRequestSchema>>;

export function commitStatusStateSchema() {
  return z.enum(['error', 'failure', 'pending', 'success']);
}

export type CommitStatusState = z.infer<ReturnType<typeof commitStatusStateSchema>>;

export function commitStatusInputSchema() {
  return z.object({
    organizationId: z.string(),
    repositoryFullName: z.string(),
    sha: z.string(),
    state: commitStatusStateSchema(),
    context: z.string(),
    description: z.string().optional(),
    targetUrl: z.string().optional(),
  });
}

export type CommitStatusInput = z.infer<ReturnType<typeof commitStatusInputSchema>>;

async function gitApiFetch(path: string, body: unknown): Promise<Response> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new MissingEnvError('INTERNAL_API_SECRET');
  const method = 'POST';
  const url = `${getClientConfig().gitApiUrl.replace(/\/+$/, '')}${path}`;
  const serialized = JSON.stringify(body);
  return fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...signRequest({ secret, method, url, body: serialized }),
    },
    body: serialized,
    cache: 'no-store',
  });
}

async function gitApiJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const response = await gitApiFetch(path, body);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`git API request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return schema.parse(await response.json());
}

export async function listTenantRepositories(organizationId: string): Promise<InstallationRepository[]> {
  const data = await gitApiJson(
    '/api/internal/repositories/list',
    { organizationId },
    z.object({ repositories: z.array(installationRepositorySchema()) })
  );
  return data.repositories;
}

export async function createTenantRepository(input: CreateRepositoryInput): Promise<InstallationRepository> {
  const data = await gitApiJson(
    '/api/internal/repositories/create',
    createRepositoryInputSchema().parse(input),
    z.object({ repository: installationRepositorySchema() })
  );
  return data.repository;
}

export async function commitContents(input: CommitContentsInput): Promise<CommitContentsResult> {
  return gitApiJson('/api/internal/contents/commit', commitContentsInputSchema().parse(input), commitContentsResultSchema());
}

export async function dispatchRepositoryEvent(input: RepositoryDispatchInput): Promise<void> {
  await gitApiJson(
    '/api/internal/dispatches/create',
    repositoryDispatchInputSchema().parse(input),
    z.object({ dispatched: z.boolean() })
  );
}

export async function createBotPullRequest(body: PullRequestInput): Promise<BotPullRequest> {
  const data = await gitApiJson(
    '/api/internal/pull-requests/create',
    pullRequestInputSchema().parse(body),
    z.object({ pullRequest: pullRequestSchema() })
  );
  return data.pullRequest;
}

export async function findMergedPullRequestByCommit(body: {
  organizationId: string;
  repositoryFullName: string;
  sha: string;
}): Promise<MergedPullRequest | null> {
  const data = await gitApiJson(
    '/api/internal/pull-requests/find-by-commit',
    body,
    z.object({ pullRequest: mergedPullRequestSchema().nullable() })
  );
  return data.pullRequest;
}

export async function createIssueComment(body: {
  organizationId: string;
  repositoryFullName: string;
  issueNumber: number;
  body: string;
}): Promise<{ id: number; url: string }> {
  const data = await gitApiJson(
    '/api/internal/comments/create',
    body,
    z.object({ comment: z.object({ id: z.number(), url: z.string() }) })
  );
  return data.comment;
}

export async function updateIssueComment(body: {
  organizationId: string;
  repositoryFullName: string;
  commentId: number;
  body: string;
}): Promise<{ url: string }> {
  const data = await gitApiJson(
    '/api/internal/comments/update',
    body,
    z.object({ comment: z.object({ url: z.string() }) })
  );
  return data.comment;
}

export async function createCommitStatus(body: CommitStatusInput): Promise<{ id: number }> {
  const data = await gitApiJson(
    '/api/internal/statuses/create',
    commitStatusInputSchema().parse(body),
    z.object({ status: z.object({ id: z.number() }) })
  );
  return data.status;
}
