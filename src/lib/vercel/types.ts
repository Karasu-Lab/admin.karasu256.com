export interface VercelConnection {
  accessToken: string;
  teamId?: string;
}

/** Vercel's own deployment `readyState` values (Deployments API), used verbatim rather than as raw strings so callers get exhaustiveness-checked handling instead of string comparisons. */
export type DeploymentReadyState = 'QUEUED' | 'INITIALIZING' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';

export interface DeploymentSummary {
  id: string;
  name: string;
  target: string | null;
  readyState: DeploymentReadyState;
  createdAt: number;
  inspectorUrl: string;
  errorMessage?: string;
}
