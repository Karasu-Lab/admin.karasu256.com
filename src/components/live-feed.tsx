'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package } from 'lucide-react';
import { Badge, Spinner } from '@karasu-lab/ui';
import { getLiveFeedAction } from '@/app/actions/dashboard';
import type { LiveFeedData, PackageUpdateEvent } from '@/lib/update-events';
import { SettingsItemContainer, SettingsItemGroup } from './settings/settings-item-container';
import { useReportLoading } from './settings/loading-context';

export function LiveFeed({
  tenantId,
  disabled,
  initialFeed,
}: {
  tenantId?: string;
  disabled?: boolean;
  initialFeed?: LiveFeedData | null;
}) {
  const t = useTranslations('LiveFeed');
  const [feed, setFeed] = useState<LiveFeedData | null>(initialFeed ?? null);
  useReportLoading('live-feed', feed === null);

  useEffect(() => {
    if (!tenantId) {
      setFeed(initialFeed ?? null);
      return;
    }
    setFeed(initialFeed ?? null);
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
  }, [tenantId, initialFeed]);

  const loaded = feed !== null && !disabled;
  const processing = feed?.processing ?? [];
  const recent = feed?.recent ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('processing')}</p>
        {loaded && processing.length === 0 && <p className="text-sm text-muted-foreground">{t('noProcessing')}</p>}
        {processing.length > 0 && (
          <SettingsItemGroup>
            {processing.map((event) => (
              <SettingsItemContainer
                key={event.id}
                title={event.repositoryFullName}
                description={`${event.toSha.slice(0, 7)} · ${new Date(event.startedAt).toLocaleString()}`}
                icon={Package}
                trailing={<Spinner />}
              />
            ))}
          </SettingsItemGroup>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('recentTitle')}</p>
        {loaded && recent.length === 0 && <p className="text-sm text-muted-foreground">{t('noRecent')}</p>}
        {recent.length > 0 && (
          <SettingsItemGroup>
            {recent.map((event) => (
              <RecentRow key={event.id} event={event} completedLabel={t('completed')} failedLabel={t('failed')} />
            ))}
          </SettingsItemGroup>
        )}
      </div>
    </div>
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
    <SettingsItemContainer
      title={event.repositoryFullName}
      description={`${event.toSha.slice(0, 7)}${event.finishedAt ? ` · ${new Date(event.finishedAt).toLocaleString()}` : ''}`}
      icon={Package}
      trailing={
        <Badge variant={event.status === 'completed' ? 'default' : 'destructive'}>
          {event.status === 'completed' ? completedLabel : failedLabel}
        </Badge>
      }
    />
  );
}
