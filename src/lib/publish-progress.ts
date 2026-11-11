import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { packagePublishProgress } from '@/db/schema';
import { getDb } from './admin-db';
import { getInstallationToken } from './api-auth';
import { GithubContents } from './github-contents';
import { GithubIdentifiers } from './github-identifiers';

export type PackagePublishProgress = typeof packagePublishProgress.$inferSelect;

export function recordPublishProgressInputSchema() {
  return z.object({
    organizationId: z.string(),
    packageId: z.string(),
    repositoryFullName: z.string(),
    sha: z.string(),
    sourcePullRequestNumber: z.number(),
    bumpPullRequestUrl: z.string(),
    headSha: z.string(),
  });
}

export type RecordPublishProgressInput = z.infer<ReturnType<typeof recordPublishProgressInputSchema>>;

export class PublishProgress {
  async record(input: RecordPublishProgressInput): Promise<string> {
    const id = crypto.randomUUID();
    const db = await getDb();
    await db
      .insert(packagePublishProgress)
      .values({ id, ...recordPublishProgressInputSchema().parse(input), createdAt: new Date().toISOString() });
    return id;
  }

  async setComment(id: string, organizationId: string, commentId: number): Promise<void> {
    const db = await getDb();
    await db
      .update(packagePublishProgress)
      .set({ commentId })
      .where(and(eq(packagePublishProgress.id, id), eq(packagePublishProgress.organizationId, organizationId)));
  }

  async list(organizationId: string): Promise<PackagePublishProgress[]> {
    const db = await getDb();
    return db
      .select()
      .from(packagePublishProgress)
      .where(eq(packagePublishProgress.organizationId, organizationId))
      .orderBy(asc(packagePublishProgress.createdAt));
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const db = await getDb();
    await db
      .delete(packagePublishProgress)
      .where(and(eq(packagePublishProgress.id, id), eq(packagePublishProgress.organizationId, organizationId)));
  }
}

export function publishCommentTemplatesSchema() {
  return z.object({
    pointerUpdate: z.string().min(1),
    published: z.string().min(1),
    publishFailed: z.string().min(1),
    pointerUpdating: z.string().min(1).nullable().catch(null),
    pointerUpdateFailed: z.string().min(1).nullable().catch(null),
    publishing: z.string().min(1).nullable().catch(null),
  });
}

export type PublishCommentTemplates = z.infer<ReturnType<typeof publishCommentTemplatesSchema>>;

export function publishedManifestSchema() {
  return z.object({
    name: z.string(),
    version: z.string(),
    versionNaming: z.object({ pattern: z.string().optional().catch(undefined) }).optional().catch(undefined),
  });
}

export class PublishComments {
  templatesPath = '.github/publish-progress-comments.json';
  manifestPath = 'package.json';
  placeholderPattern = /\{([A-Za-z]+)\}/g;
  defaultVersionNaming = '{version}-{shortCommitHash}';
  identifiers = new GithubIdentifiers();
  contents = new GithubContents();

  async loadTemplates(organizationId: string, npmRepositoryFullName: string): Promise<PublishCommentTemplates | null> {
    const { token } = await getInstallationToken(organizationId);
    const content = await this.contents.readJson(token, npmRepositoryFullName, this.templatesPath);
    const parsed = publishCommentTemplatesSchema().safeParse(content);
    return parsed.success ? parsed.data : null;
  }

  render(template: string, values: Record<string, string>): string {
    return template.replace(this.placeholderPattern, (placeholder, key: string) =>
      Object.hasOwn(values, key) ? values[key] : placeholder
    );
  }

  async resolvePublishedPackage(
    organizationId: string,
    repositoryFullName: string,
    sha: string
  ): Promise<{ name: string; version: string } | null> {
    if (!this.identifiers.isCommitSha(sha)) return null;
    const { token } = await getInstallationToken(organizationId);
    const content = await this.contents.readJson(token, repositoryFullName, this.manifestPath, sha);
    const manifest = publishedManifestSchema().safeParse(content);
    if (!manifest.success) return null;
    const pattern = manifest.data.versionNaming?.pattern ?? this.defaultVersionNaming;
    const version = pattern
      .replaceAll('{version}', manifest.data.version)
      .replaceAll('{shortCommitHash}', sha.slice(0, 7))
      .replaceAll('{commitHash}', sha);
    return { name: manifest.data.name, version };
  }
}
