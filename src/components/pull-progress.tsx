'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ProgressBar, Badge } from '@Hashibutogarasu/ui';

interface PullEvent {
  status: string;
  id?: string;
  progress?: string;
  progressDetail?: { current?: number; total?: number };
}

interface PullProgressProps {
  imageName: string;
  onDone?: () => void;
}

export function PullProgress({ imageName, onDone }: PullProgressProps) {
  const t = useTranslations('Images.pull');
  const [events, setEvents] = useState<PullEvent[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/images/pull?image=${encodeURIComponent(imageName)}`);
    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const parsed: PullEvent = JSON.parse(e.data) as PullEvent;
        if (parsed.status === 'done') {
          setDone(true);
          es.close();
          onDone?.();
          return;
        }
        setEvents((prev) => {
          const idx = prev.findIndex((p) => p.id === parsed.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = parsed;
            return next;
          }
          return [...prev, parsed];
        });
      } catch {
        /* ignore parse errors */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [imageName, onDone]);

  if (done) {
    return <Badge variant="secondary">{t('done')}</Badge>;
  }

  return (
    <div className="space-y-2">
      {events.map((ev, i) => {
        const pct =
          ev.progressDetail?.total && ev.progressDetail.current ? Math.round((ev.progressDetail.current / ev.progressDetail.total) * 100) : 0;
        return (
          <div key={i} className="text-xs space-y-0.5">
            <div className="flex justify-between text-muted-foreground">
              <span>{ev.id ?? ev.status}</span>
              <span>{ev.progress ?? ev.status}</span>
            </div>
            {pct > 0 && <ProgressBar value={pct / 100} className="h-1" />}
          </div>
        );
      })}
      {events.length === 0 && <p className="text-sm text-muted-foreground">{t('progress')}</p>}
    </div>
  );
}
