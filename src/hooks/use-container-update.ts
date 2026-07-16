'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { triggerUpdate, onProgress, onLayer } from '@/lib/update-stream';

export interface LayerState {
  status: string;
  progress?: string;
}

export function useContainerUpdate(containerId: string) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | undefined>();
  const [layers, setLayers] = useState<Map<string, LayerState>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const offProgress = onProgress((data) => {
      if (data.containerId !== containerId) return;
      setStatus(data.status);
      setDetail(data.detail);
      if (data.status === 'stopping') {
        setLayers(new Map());
      }
      if (data.status === 'done' || data.status === 'error') {
        timerRef.current = setTimeout(() => {
          setStatus(null);
          setDetail(undefined);
          setLayers(new Map());
          router.refresh();
        }, 800);
      }
    });

    const offLayer = onLayer((data) => {
      if (data.containerId !== containerId) return;
      setLayers((prev) => new Map(prev).set(data.layerId, { status: data.status, progress: data.progress }));
    });

    return () => {
      offProgress();
      offLayer();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [containerId, router]);

  const trigger = useCallback(() => {
    triggerUpdate(containerId);
  }, [containerId]);

  return {
    trigger,
    status,
    detail,
    pending: !!status && status !== 'done' && status !== 'error',
    layers,
  };
}
