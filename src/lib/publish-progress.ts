import 'server-only';
import { queryAdminDb, runAdminDb } from './admin-db';
import { getInstallationToken } from './api-auth';

export interface PackagePublishProgress {
  id: string;
  organizationId: string;
  packageId: string;
  repositoryFullName: string;
  sha: string;
  sourcePullRequestNumber: number;
  bumpPullRequestUrl: string;
  commentId: number | null;
  headSha: string | null;
  createdAt: string;
}

interface PackagePublishProgressRow {
  id: string;
  organization_id: string;
  package_id: string;
  repository_full_name: string;
  sha: string;
  source_pull_request_number: number;
  bump_pull_request_url: string;
  comment_id: number | null;
  head_sha: string | null;
  created_at: string;
}

function toPackagePublishProgress(row: PackagePublishProgressRow): PackagePublishProgress {
  return {
    id: row.id,
    organizationId: row.organization_id,
    packageId: row.package_id,
    repositoryFullName: row.repository_full_name,
    sha: row.sha,
    sourcePullRequestNumber: row.source_pull_request_number,
    bumpPullRequestUrl: row.bump_pull_request_url,
    commentId: row.comment_id,
    headSha: row.head_sha,
    createdAt: row.created_at,
  };
}

export async function recordPublishProgress(input: {
  organizationId: string;
  packageId: string;
  repositoryFullName: string;
  sha: string;
  sourcePullRequestNumber: number;
  bumpPullRequestUrl: string;
  headSha: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await runAdminDb(
    'INSERT INTO package_publish_progress (id, organization_id, package_id, repository_full_name, sha, source_pull_request_number, bump_pull_request_url, head_sha, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      input.organizationId,
      input.packageId,
      input.repositoryFullName,
      input.sha,
      input.sourcePullRequestNumber,
      input.bumpPullRequestUrl,
      input.headSha,
      new Date().toISOString(),
    ]
  );
  return id;
}

export async function setPublishProgressComment(id: string, commentId: number): Promise<void> {
  await runAdminDb('UPDATE package_publish_progress SET comment_id = ? WHERE id = ?', [commentId, id]);
}

export async function listPublishProgress(organizationId: string): Promise<PackagePublishProgress[]> {
  const rows = await queryAdminDb<PackagePublishProgressRow>(
    'SELECT id, organization_id, package_id, repository_full_name, sha, source_pull_request_number, bump_pull_request_url, comment_id, head_sha, created_at FROM package_publish_progress WHERE organization_id = ? ORDER BY created_at ASC',
    [organizationId]
  );
  return rows.map(toPackagePublishProgress);
}

export async function deletePublishProgress(id: string): Promise<void> {
  await runAdminDb('DELETE FROM package_publish_progress WHERE id = ?', [id]);
}

export interface PublishCommentTemplates {
  pointerUpdate: string;
  published: string;
  publishFailed: string;
}

const PUBLISH_COMMENT_TEMPLATES_PATH = '.github/publish-progress-comments.json';

export async function loadPublishCommentTemplates(
  organizationId: string,
  npmRepositoryFullName: string
): Promise<PublishCommentTemplates | null> {
  const { token } = await getInstallationToken(organizationId);
  const response = await fetch(`https://api.github.com/repos/${npmRepositoryFullName}/contents/${PUBLISH_COMMENT_TEMPLATES_PATH}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: ['Bearer', token].join(' '),
      'user-agent': 'karasu-lab-admin',
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { content?: string } | null;
  if (!data?.content) return null;
  let parsed: { pointerUpdate?: unknown; published?: unknown; publishFailed?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) as typeof parsed;
  } catch {
    return null;
  }
  if (
    typeof parsed.pointerUpdate !== 'string' ||
    parsed.pointerUpdate.length === 0 ||
    typeof parsed.published !== 'string' ||
    parsed.published.length === 0 ||
    typeof parsed.publishFailed !== 'string' ||
    parsed.publishFailed.length === 0
  ) {
    return null;
  }
  return { pointerUpdate: parsed.pointerUpdate, published: parsed.published, publishFailed: parsed.publishFailed };
}

export function renderCommentTemplate(template: string, values: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{${key}}`, value);
  }
  return rendered;
}

export async function resolvePublishedPackage(
  organizationId: string,
  repositoryFullName: string,
  sha: string
): Promise<{ name: string; version: string } | null> {
  const { token } = await getInstallationToken(organizationId);
  const response = await fetch(`https://api.github.com/repos/${repositoryFullName}/contents/package.json?ref=${sha}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: ['Bearer', token].join(' '),
      'user-agent': 'karasu-lab-admin',
      'x-github-api-version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { content?: string } | null;
  if (!data?.content) return null;
  let manifest: { name?: unknown; version?: unknown; versionNaming?: { pattern?: unknown } };
  try {
    manifest = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) as typeof manifest;
  } catch {
    return null;
  }
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') return null;
  const pattern = typeof manifest.versionNaming?.pattern === 'string' ? manifest.versionNaming.pattern : '{version}-{shortCommitHash}';
  const version = pattern
    .replaceAll('{version}', manifest.version)
    .replaceAll('{shortCommitHash}', sha.slice(0, 7))
    .replaceAll('{commitHash}', sha);
  return { name: manifest.name, version };
}
