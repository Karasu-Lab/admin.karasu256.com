import 'server-only';
import { MissingEnvError, signRequest } from '@karasu-lab/utils/server';
import { getClientConfig } from './client-config';

export interface RepositoryAccess {
  repositoryId: number;
  remote: string | null;
  visibility: 'public' | 'private' | null;
  allowed: boolean;
  reason?: string;
}

export interface SignedCommitRequest {
  organizationId: string;
  signingUserId: string;
  repositoryId: number;
  repositoryFullName: string;
  branch: string;
  baseBranch?: string;
  message: string;
  fileChanges?: { path: string; content: string }[];
  gitlinkChanges?: { path: string; oid: string }[];
  gitmodulesAdditions?: { path: string; url: string; branch: string }[];
  expectGitlinkPath?: string;
}

export type SignedCommitResult =
  | { outcome: 'pushed'; commitOid: string; branch: string }
  | { outcome: 'no_changes'; branch: string }
  | { outcome: 'already_synced'; branch: string }
  | { outcome: 'submodule_not_found'; branch: string };

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

async function gitApiJson<T>(path: string, body: unknown): Promise<T> {
  const response = await gitApiFetch(path, body);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`git API request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export type MirrorUploadUrlResult =
  | { exists: true; key: string }
  | { exists: false; key: string; uploadUrl: string; expiresAt: string };

export async function getRepositoryAccess(repositoryId: number): Promise<RepositoryAccess> {
  return gitApiJson<RepositoryAccess>('/api/internal/repositories/access', { repositoryId });
}

export async function requestMirrorUploadUrl(input: {
  repositoryId: number;
  repositoryFullName: string;
}): Promise<MirrorUploadUrlResult> {
  const response = await gitApiFetch('/api/internal/mirrors/upload-url', input);
  if (response.status === 403) {
    const data = (await response.json().catch(() => null)) as RepositoryAccess | null;
    if (data && !data.allowed) {
      throw new Error(
        `git API blocked the mirror upload for repository ${input.repositoryFullName}: visibility=${data.visibility ?? 'unknown'}, reason=${data.reason ?? 'not_allowed'}`
      );
    }
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`git API request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as MirrorUploadUrlResult;
}

export async function requestSignedCommit(input: SignedCommitRequest): Promise<SignedCommitResult> {
  const response = await gitApiFetch('/api/internal/mirrors/commit', input);
  if (response.status === 403) {
    const data = (await response.json().catch(() => null)) as RepositoryAccess | null;
    if (data && !data.allowed) {
      throw new Error(
        `git API blocked the commit for repository ${input.repositoryFullName}: visibility=${data.visibility ?? 'unknown'}, reason=${data.reason ?? 'not_allowed'}`
      );
    }
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`git API request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as SignedCommitResult;
}
