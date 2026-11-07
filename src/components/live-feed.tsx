'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from '@karasu-lab/ui';
import { getLiveFeedAction, type LiveFeedData, type PackageUpdateEvent } from '@/app/actions';

export function LiveFeed({ tenantId, disabled }: { tenantId?: string; disabled?: boolean }) {
  const t = useTranslations('LiveFeed');
  const [feed, setFeed] = useState<LiveFeedData | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setFeed(null);
      return;
    }
    let cancelled = false;
    getLiveFeedAction(tenantId)
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch(() => {});
    const source = new EventSource(`/api/live?tenant=${encodeURIComponent(tenantId)}`);
    source.onmessage = (event) => {
      try {
        setFeed(JSON.parse(event.data as string) as LiveFeedData);
      } catch {
      }
    };
    return () => {
      cancelled = true;
      source.close();
    };
  }, [tenantId]);

  const loaded = feed !== null && !disabled;
  const processing = feed?.processing ?? [];
  const recent = feed?.recent ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('processing')}</p>
          {loaded && processing.length === 0 && <p className="text-sm text-muted-foreground">{t('noProcessing')}</p>}
          {processing.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              <Spinner />
              <span className="min-w-0 font-medium break-words">{event.repositoryFullName}</span>
              <span className="text-sm text-muted-foreground">{event.toSha.slice(0, 7)}</span>
              <span className="ml-auto text-sm text-muted-foreground">{new Date(event.startedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('recentTitle')}</p>
          {loaded && recent.length === 0 && <p className="text-sm text-muted-foreground">{t('noRecent')}</p>}
          {recent.map((event) => (
            <RecentRow key={event.id} event={event} completedLabel={t('completed')} failedLabel={t('failed')} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentRow({
  event,
  completedLabel,
  failedLabel,
}: {
  event: PackageUpdateEvent;
  completedLabel: string;
  failedLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <span className="min-w-0 font-medium break-words">{event.repositoryFullName}</span>
      <Badge variant={event.status === 'completed' ? 'default' : 'destructive'}>
        {event.status === 'completed' ? completedLabel : failedLabel}
      </Badge>
      <span className="text-sm text-muted-foreground">{event.toSha.slice(0, 7)}</span>
      <span className="ml-auto text-sm text-muted-foreground">
        {event.finishedAt ? new Date(event.finishedAt).toLocaleString() : ''}
      </span>
    </div>
  );
}
