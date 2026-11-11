import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { isNotNull } from 'drizzle-orm';

export const tenantNpmRepository = sqliteTable(
  'tenant_npm_repository',
  {
    organizationId: text('organization_id').primaryKey(),
    owner: text('owner').notNull(),
    npmRepositoryName: text('npm_repository_name').notNull(),
    workflowTemplateRepositoryName: text('workflow_template_repository_name').notNull(),
    npmRepositoryId: integer('npm_repository_id'),
    npmRepositoryFullName: text('npm_repository_full_name'),
    workflowTemplateRepositoryId: integer('workflow_template_repository_id'),
    workflowTemplateRepositoryFullName: text('workflow_template_repository_full_name'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_tenant_npm_repository_npm_repository_id')
      .on(table.npmRepositoryId)
      .where(isNotNull(table.npmRepositoryId)),
    uniqueIndex('idx_tenant_npm_repository_npm_repository_full_name')
      .on(table.npmRepositoryFullName)
      .where(isNotNull(table.npmRepositoryFullName)),
    uniqueIndex('idx_tenant_npm_repository_workflow_template_repository_id')
      .on(table.workflowTemplateRepositoryId)
      .where(isNotNull(table.workflowTemplateRepositoryId)),
  ]
);

export const tenantSetupCompletion = sqliteTable('tenant_setup_completion', {
  organizationId: text('organization_id').primaryKey(),
  completedAt: text('completed_at').notNull(),
});

export const tenantWebhookSecret = sqliteTable('tenant_webhook_secret', {
  organizationId: text('organization_id').primaryKey(),
  encryptedSecret: text('encrypted_secret').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const packageUpdateEvents = sqliteTable('package_update_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  packageId: text('package_id').notNull(),
  repositoryFullName: text('repository_full_name').notNull(),
  status: text('status').notNull(),
  fromSha: text('from_sha'),
  toSha: text('to_sha').notNull(),
  reason: text('reason'),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  sourcePullRequestNumber: integer('source_pull_request_number'),
  sourceHeadSha: text('source_head_sha'),
  pointerCommentId: integer('pointer_comment_id'),
});

export const packagePublishProgress = sqliteTable('package_publish_progress', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  packageId: text('package_id').notNull(),
  repositoryFullName: text('repository_full_name').notNull(),
  sha: text('sha').notNull(),
  sourcePullRequestNumber: integer('source_pull_request_number').notNull(),
  bumpPullRequestUrl: text('bump_pull_request_url').notNull(),
  createdAt: text('created_at').notNull(),
  commentId: integer('comment_id'),
  headSha: text('head_sha'),
});

export const dedupeKeys = sqliteTable('dedupe_keys', {
  key: text('key').primaryKey(),
  receivedAt: text('received_at').notNull(),
});
