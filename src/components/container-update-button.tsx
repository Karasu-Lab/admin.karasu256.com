'use client';

import { useTranslations } from 'next-intl';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@Hashibutogarasu/ui';
import { AlertCircle, CheckCircle2, Circle, Download, Loader2, RefreshCw } from 'lucide-react';
import { useContainerUpdate } from '@/hooks/use-container-update';

const UPDATE_STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pulling: Download,
  stopping: Circle,
  starting: Circle,
  done: CheckCircle2,
  error: AlertCircle,
};

const UPDATE_STATUS_COLOR: Record<string, string> = {
  pulling: 'text-blue-500',
  stopping: 'text-amber-500',
  starting: 'text-amber-500',
  done: 'text-green-500',
  error: 'text-destructive',
};

interface ContainerUpdateButtonProps {
  containerId: string;
}

export function ContainerUpdateButton({ containerId }: ContainerUpdateButtonProps) {
  const t = useTranslations('Containers');
  const { trigger, status, pending } = useContainerUpdate(containerId);

  const StatusIconComponent = status ? (UPDATE_STATUS_ICON[status] ?? Circle) : null;
  const statusColor = status ? (UPDATE_STATUS_COLOR[status] ?? 'text-muted-foreground') : '';
  const statusLabel = status ? t(`updateProgress.${status}` as Parameters<typeof t>[0]) : '';

  return (
    <>
      <Button size="icon" variant="ghost" aria-label={t('update')} disabled={pending} onClick={() => trigger()}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      </Button>
      {StatusIconComponent && status && (
        <Tooltip>
          <TooltipTrigger className="cursor-default">
            <StatusIconComponent className={`size-4 shrink-0 ${statusColor}`} />
          </TooltipTrigger>
          <TooltipContent>{statusLabel}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
