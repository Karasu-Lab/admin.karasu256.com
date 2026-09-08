'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Marker,
  buttonVariants,
  type MarkerStep,
} from '@Hashibutogarasu/ui';
import type { DeploymentSummary, DeploymentReadyState } from '@/lib/vercel';

interface DeploymentsSectionProps {
  connected: boolean;
  deployments: DeploymentSummary[] | null;
}

/**
 * Single source of truth for how each Vercel `readyState` is displayed —
 * the `MarkerStep` status and the list badge's variant are both derived
 * from this, so the two never drift into disagreeing string comparisons.
 * Exhaustive over {@link DeploymentReadyState}: adding a new state is a
 * compile error here until handled.
 */
function readyStateDisplay(readyState: DeploymentReadyState): {
  markerStatus: MarkerStep['status'];
  badgeVariant: 'default' | 'destructive' | 'secondary';
} {
  switch (readyState) {
    case 'READY':
      return { markerStatus: 'complete', badgeVariant: 'default' };
    case 'ERROR':
    case 'CANCELED':
      return { markerStatus: 'error', badgeVariant: 'destructive' };
    case 'QUEUED':
    case 'INITIALIZING':
    case 'BUILDING':
      return { markerStatus: 'current', badgeVariant: 'secondary' };
  }
}

/** Renders the deployment's actual `readyState`, as Vercel returned it — no invented step sequence or reordering, just that one value's status. */
function buildSteps(readyState: DeploymentReadyState): MarkerStep[] {
  return [{ key: readyState, label: readyState, status: readyStateDisplay(readyState).markerStatus }];
}

/** Dashboard section listing the 5 most recent Vercel deployments; clicking one opens a dialog with its step progress and a link to Vercel's own inspector page. */
export function DeploymentsSection({ connected, deployments }: DeploymentsSectionProps) {
  const t = useTranslations('Deployments');
  const [selected, setSelected] = useState<DeploymentSummary | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!connected && <p className="text-sm text-muted-foreground">{t('notConnected')}</p>}
        {connected && (!deployments || deployments.length === 0) && <p className="text-sm text-muted-foreground">{t('noDeployments')}</p>}
        {connected &&
          deployments?.map((deployment) => (
            <button
              key={deployment.id}
              type="button"
              onClick={() => setSelected(deployment)}
              className="flex w-full items-center justify-between gap-4 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
            >
              <span className="min-w-0 truncate text-sm font-medium">{deployment.name}</span>
              <Badge variant={readyStateDisplay(deployment.readyState).badgeVariant}>{deployment.readyState}</Badge>
            </button>
          ))}
      </CardContent>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Marker steps={buildSteps(selected.readyState)} />
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {selected.target && (
                    <div>
                      <dt className="text-muted-foreground">{t('target')}</dt>
                      <dd>{selected.target}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">{t('created')}</dt>
                    <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                  </div>
                </dl>
                {selected.errorMessage && <p className="text-sm text-destructive">{selected.errorMessage}</p>}
              </div>
              <DialogFooter>
                <a href={selected.inspectorUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline' })}>
                  {t('viewDetails')}
                </a>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
