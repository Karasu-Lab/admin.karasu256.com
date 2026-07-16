'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { NavSidebar } from '@/components/nav-sidebar';
import { LogViewer } from '@/components/log-viewer';
import { LogToolbar } from '@/components/log-toolbar';
import { ChevronLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ContainerLogsPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations('Logs');
  const [lines, setLines] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      <NavSidebar />
      <main className="flex flex-col flex-1 p-6 gap-4 min-h-0 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/containers/${id}`}
              className="inline-flex items-center justify-center rounded-md p-2 text-sm hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>
          <LogToolbar lines={lines} autoScroll={autoScroll} onAutoScrollChange={setAutoScroll} onClear={() => setLines([])} />
        </div>
        <div className="flex-1 min-h-0 min-w-0">
          <LogViewer containerId={id} tail={500} lines={lines} autoScroll={autoScroll} onLine={(line) => setLines((prev) => [...prev, line])} />
        </div>
      </main>
    </div>
  );
}
