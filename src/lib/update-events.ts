import 'server-only';
import { and, desc, eq, ne, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { packageUpdateEvents } from '@/db/schema';
import { getDb } from './admin-db';

export function packageUpdateStatusSchema() {
  return z.enum(['processing', 'completed', 'failed']);
}

export type PackageUpdateStatus = z.infer<ReturnType<typeof packageUpdateStatusSchema>>;

export function packageUpdateEventSchema() {
  return z.object({
    id: z.string(),
    organizationId: z.string(),
    packageId: z.string(),
    repositoryFullName: z.string(),
    status: packageUpdateStatusSchema(),
    fromSha: z.string().nullable(),
    toSha: z.string(),
    reason: z.string().nullable(),
    startedAt: z.string(),
    finishedAt: z.string().nullable(),
  });
}

export type PackageUpdateEvent = z.infer<ReturnType<typeof packageUpdateEventSchema>>;

export function liveFeedDataSchema() {
  return z.object({
    processing: z.array(packageUpdateEventSchema()),
    recent: z.array(packageUpdateEventSchema()),
  });
}

export type LiveFeedData = z.infer<ReturnType<typeof liveFeedDataSchema>>;

export function packageUpdateContextSchema() {
  return z.object({
    sourcePullRequestNumber: z.number().nullable(),
    sourceHeadSha: z.string().nullable(),
    pointerCommentId: z.number().nullable(),
  });
}

export type PackageUpdateContext = z.infer<ReturnType<typeof packageUpdateContextSchema>>;

export function packageUpdateRecordSchema() {
  return packageUpdateEventSchema().extend(packageUpdateContextSchema().shape);
}

export type PackageUpdateRecord = z.infer<ReturnType<typeof packageUpdateRecordSchema>>;

export function startPackageUpdateInputSchema() {
  return z.object({
    organizationId: z.string(),
    packageId: z.string(),
    repositoryFullName: z.string(),
    fromSha: z.string().nullable(),
    toSha: z.string(),
  });
}

export type StartPackageUpdateInput = z.infer<ReturnType<typeof startPackageUpdateInputSchema>>;

type PackageUpdateRow = typeof packageUpdateEvents.$inferSelect;

export class PackageUpdateEvents {
  retainedFinishedEvents = 50;
  recentEventsLimit = 10;
  statuses = packageUpdateStatusSchema().enum;

  private toEvent(row: PackageUpdateRow): PackageUpdateEvent {
    const status = packageUpdateStatusSchema().safeParse(row.status);
    return {
      id: row.id,
      organizationId: row.organizationId,
      packageId: row.packageId,
      repositoryFullName: row.repositoryFullName,
      status: status.success ? status.data : this.statuses.processing,
      fromSha: row.fromSha,
      toSha: row.toSha,
      reason: row.reason,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    };
  }

  async start(input: StartPackageUpdateInput): Promise<string> {
    const id = crypto.randomUUID();
    const db = await getDb();
    await db.insert(packageUpdateEvents).values({
      id,
      ...startPackageUpdateInputSchema().parse(input),
      status: this.statuses.processing,
      startedAt: new Date().toISOString(),
    });
    return id;
  }

  async setContext(id: string, organizationId: string, context: PackageUpdateContext): Promise<void> {
    const db = await getDb();
    await db
      .update(packageUpdateEvents)
      .set(packageUpdateContextSchema().parse(context))
      .where(and(eq(packageUpdateEvents.id, id), eq(packageUpdateEvents.organizationId, organizationId)));
  }

  async get(id: string, organizationId: string): Promise<PackageUpdateRecord | null> {
    const db = await getDb();
    const rows = await db
      .select()
      .from(packageUpdateEvents)
      .where(and(eq(packageUpdateEvents.id, id), eq(packageUpdateEvents.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      ...this.toEvent(row),
      sourcePullRequestNumber: row.sourcePullRequestNumber,
      sourceHeadSha: row.sourceHeadSha,
      pointerCommentId: row.pointerCommentId,
    };
  }

  async finish(
    id: string,
    organizationId: string,
    status: Exclude<PackageUpdateStatus, 'processing'>,
    reason?: string
  ): Promise<void> {
    const db = await getDb();
    await db
      .update(packageUpdateEvents)
      .set({ status, reason: reason ?? null, finishedAt: new Date().toISOString() })
      .where(and(eq(packageUpdateEvents.id, id), eq(packageUpdateEvents.organizationId, organizationId)));
    const finishedInOrganization = and(
      eq(packageUpdateEvents.organizationId, organizationId),
      ne(packageUpdateEvents.status, this.statuses.processing)
    );
    const kept = await db
      .select({ id: packageUpdateEvents.id })
      .from(packageUpdateEvents)
      .where(finishedInOrganization)
      .orderBy(desc(packageUpdateEvents.finishedAt))
      .limit(this.retainedFinishedEvents);
    if (kept.length === 0) return;
    await db.delete(packageUpdateEvents).where(
      and(
        finishedInOrganization,
        notInArray(
          packageUpdateEvents.id,
          kept.map((row) => row.id)
        )
      )
    );
  }

  async liveFeed(organizationId: string): Promise<LiveFeedData> {
    const db = await getDb();
    const processingRows = await db
      .select()
      .from(packageUpdateEvents)
      .where(and(eq(packageUpdateEvents.organizationId, organizationId), eq(packageUpdateEvents.status, this.statuses.processing)))
      .orderBy(desc(packageUpdateEvents.startedAt));
    const recentRows = await db
      .select()
      .from(packageUpdateEvents)
      .where(and(eq(packageUpdateEvents.organizationId, organizationId), ne(packageUpdateEvents.status, this.statuses.processing)))
      .orderBy(desc(packageUpdateEvents.finishedAt))
      .limit(this.recentEventsLimit);
    return {
      processing: processingRows.map((row) => this.toEvent(row)),
      recent: recentRows.map((row) => this.toEvent(row)),
    };
  }
}
