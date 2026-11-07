import { z } from 'zod';

const installationSchema = z.object({
  id: z.number(),
});

const repositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  default_branch: z.string().optional(),
});

export const githubWebhookBaseSchema = z.object({
  installation: installationSchema,
  repository: repositorySchema.optional(),
});

export type GitHubWebhookBase = z.infer<typeof githubWebhookBaseSchema>;

export const githubPushWebhookPartSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  repository: repositorySchema,
});

export const githubPushWebhookPayloadSchema = githubWebhookBaseSchema.extend(githubPushWebhookPartSchema.shape);

export type GitHubPushWebhookPayload = z.infer<typeof githubPushWebhookPayloadSchema>;

export const githubInstallationWebhookActionSchema = z.enum([
  'created',
  'deleted',
  'suspend',
  'unsuspend',
  'new_permissions_accepted',
]);

export type GitHubInstallationWebhookAction = z.infer<typeof githubInstallationWebhookActionSchema>;

export const githubInstallationWebhookPartSchema = z.object({
  action: githubInstallationWebhookActionSchema,
  installation: installationSchema.extend({
    account: z.object({
      id: z.number(),
      login: z.string(),
      type: z.string(),
    }),
  }),
});

export const githubInstallationWebhookPayloadSchema = githubWebhookBaseSchema.extend(
  githubInstallationWebhookPartSchema.shape
);

export type GitHubInstallationWebhookPayload = z.infer<typeof githubInstallationWebhookPayloadSchema>;

export const githubWorkflowRunWebhookPartSchema = z.object({
  action: z.string(),
  repository: repositorySchema,
  workflow_run: z.object({
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable().optional(),
    head_sha: z.string(),
    html_url: z.string(),
    pull_requests: z
      .array(
        z.object({
          head: z.object({
            ref: z.string(),
          }),
        })
      )
      .optional(),
  }),
});

export const githubWorkflowRunWebhookPayloadSchema = githubWebhookBaseSchema.extend(
  githubWorkflowRunWebhookPartSchema.shape
);

export type GitHubWorkflowRunWebhookPayload = z.infer<typeof githubWorkflowRunWebhookPayloadSchema>;

export type GitHubWebhookParseResult =
  | { success: true; event: 'push'; data: GitHubPushWebhookPayload }
  | { success: true; event: 'installation'; data: GitHubInstallationWebhookPayload }
  | { success: true; event: 'workflow_run'; data: GitHubWorkflowRunWebhookPayload }
  | { success: false; reason: 'unknown_event' }
  | { success: false; reason: 'invalid_payload'; error: z.ZodError };

export function parseGitHubWebhookPayload(event: string, payload: unknown): GitHubWebhookParseResult {
  const base = githubWebhookBaseSchema.safeParse(payload);
  if (!base.success) return { success: false, reason: 'invalid_payload', error: base.error };
  switch (event) {
    case 'push': {
      const part = githubPushWebhookPartSchema.safeParse(payload);
      if (!part.success) return { success: false, reason: 'invalid_payload', error: part.error };
      return { success: true, event, data: { ...base.data, ...part.data } };
    }
    case 'installation': {
      const part = githubInstallationWebhookPartSchema.safeParse(payload);
      if (!part.success) return { success: false, reason: 'invalid_payload', error: part.error };
      return { success: true, event, data: { ...base.data, ...part.data } };
    }
    case 'workflow_run': {
      const part = githubWorkflowRunWebhookPartSchema.safeParse(payload);
      if (!part.success) return { success: false, reason: 'invalid_payload', error: part.error };
      return { success: true, event, data: { ...base.data, ...part.data } };
    }
    default:
      return { success: false, reason: 'unknown_event' };
  }
}
