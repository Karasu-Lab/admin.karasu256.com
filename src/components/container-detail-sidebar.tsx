'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import { LogViewer } from '@/components/log-viewer';
import { LogToolbar } from '@/components/log-toolbar';
import { LogMaximizeButton } from '@/components/log-buttons';
import { ContainerUpdatePanel } from '@/components/container-update-panel';
import { useContainerUpdate } from '@/hooks/use-container-update';

interface ContainerDetailSidebarProps {
  containerId: string;
}

export function ContainerDetailSidebar({ containerId }: ContainerDetailSidebarProps) {
  const tLogs = useTranslations('Logs');
  const router = useRouter();
  const { layers } = useContainerUpdate(containerId);
  const [lines, setLines] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [maximizing, setMaximizing] = useState(false);

  if (layers.size > 0) {
    return <ContainerUpdatePanel containerId={containerId} />;
  }

  return (
    <>
      <AnimatePresence>
        {maximizing && (
          <motion.div
            key="maximize-overlay"
            className="fixed inset-0 z-50 bg-background"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onAnimationComplete={() => {
              router.push(`/containers/${containerId}/logs`);
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-[440px] flex flex-col min-h-0">
        <div className="flex items-center justify-between pt-4 pb-1 shrink-0">
          <p className="text-sm font-semibold text-muted-foreground">{tLogs('title')}</p>
          <div className="flex items-center gap-1">
            <LogToolbar compact lines={lines} autoScroll={autoScroll} onAutoScrollChange={setAutoScroll} onClear={() => setLines([])} />
            <LogMaximizeButton compact onClick={() => setMaximizing(true)} />
          </div>
        </div>
        <LogViewer
          containerId={containerId}
          lines={lines}
          autoScroll={autoScroll}
          onLine={(line) => setLines((prev) => [...prev, line])}
          className="max-h-[calc(100vh-10rem)] min-h-64"
        />
      </div>
    </>
  );
}
