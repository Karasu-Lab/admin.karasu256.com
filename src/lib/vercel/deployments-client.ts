import 'server-only';
import type { VercelConnection, DeploymentSummary, DeploymentReadyState } from './types';

interface VercelDeploymentApiItem {
  uid: string;
  name: string;
  target?: string | null;
  readyState: DeploymentReadyState;
  createdAt: number;
  inspectorUrl: string;
  errorMessage?: string;
}

/** Talks to Vercel's REST API for deployment data, using an already-obtained connection. */
export class VercelDeploymentsClient {
  private static readonly DEPLOYMENTS_URL = 'https://api.vercel.com/v6/deployments';

  /** Returns the `limit` most recent deployments for `connection`'s account/team. Throws on any API failure rather than swallowing it. */
  async listRecent(connection: VercelConnection, limit = 5): Promise<DeploymentSummary[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (connection.teamId) params.set('teamId', connection.teamId);

    const res = await fetch(`${VercelDeploymentsClient.DEPLOYMENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Vercel deployments request failed with status ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { deployments?: VercelDeploymentApiItem[] };
    return (data.deployments ?? []).map((d) => ({
      id: d.uid,
      name: d.name,
      target: d.target ?? null,
      readyState: d.readyState,
      createdAt: d.createdAt,
      inspectorUrl: d.inspectorUrl,
      errorMessage: d.errorMessage,
    }));
  }
}
