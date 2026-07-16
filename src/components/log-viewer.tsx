'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ScrollArea } from '@Hashibutogarasu/ui';

interface LogViewerProps {
  containerId: string;
  tail?: number;
  lines: string[];
  autoScroll: boolean;
  onLine: (line: string) => void;
  className?: string;
}

export function LogViewer({ containerId, tail = 100, lines, autoScroll, onLine, className }: LogViewerProps) {
  const t = useTranslations('Logs');
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const onLineRef = useRef(onLine);

  useEffect(() => {
    onLineRef.current = onLine;
  });

  useEffect(() => {
    const es = new EventSource(`/api/containers/${containerId}/logs?tail=${tail}`);
    es.onopen = () => setConnected(true);
    es.onmessage = (e: MessageEvent<string>) => {
      onLineRef.current(e.data);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [containerId, tail]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  return (
    <ScrollArea className={`w-full rounded-md border bg-muted/30 font-mono text-xs ${className ?? 'h-full max-h-[calc(100vh-10rem)] min-h-96'}`}>
      {!connected && <p className="px-4 py-3 text-muted-foreground">{t('connecting')}</p>}
      {connected && lines.length === 0 && <p className="px-4 py-3 text-muted-foreground">{t('empty')}</p>}
      {lines.map((line, i) => (
        <div key={i} className="px-4 py-1.5 border-b border-border last:border-0 whitespace-pre-wrap break-all">
          {line}
        </div>
      ))}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
