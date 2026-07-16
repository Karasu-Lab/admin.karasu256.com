'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from '@Hashibutogarasu/ui';
import { AlertCircle, CheckCircle2, Circle, Download, Loader2, RefreshCw } from 'lucide-react';
import { useContainerUpdate } from '@/hooks/use-container-update';
import { ContainerToggleButton } from './container-toggle-button';
import { ContainerTagPullButton } from './container-tag-pull-button';

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

interface ContainerPort {
  IP: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  ports: ContainerPort[];
}

interface ContainerCardProps {
  container: ContainerInfo;
}

export function ContainerCard({ container }: ContainerCardProps) {
  const t = useTranslations('Containers');
  const router = useRouter();
  const { trigger, status, pending } = useContainerUpdate(container.id);

  const displayName = container.names[0]?.replace(/^\//, '') ?? container.id.slice(0, 12);
  const StatusIconComponent = status ? (UPDATE_STATUS_ICON[status] ?? Circle) : null;
  const statusColor = status ? (UPDATE_STATUS_COLOR[status] ?? 'text-muted-foreground') : '';
  const statusLabel = status ? t(`updateProgress.${status}` as Parameters<typeof t>[0]) : '';

  return (
    <Card className="cursor-pointer relative overflow-hidden h-full" onClick={() => router.push(`/containers/${container.id}`)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{displayName}</CardTitle>
          <Badge variant={container.state === 'running' ? 'default' : 'secondary'}>{container.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3">
        <p className="text-xs text-muted-foreground">{container.image}</p>
        {container.ports.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {container.ports.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : p.PrivatePort}/{p.Type}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 mt-auto">
          <ContainerToggleButton containerId={container.id} state={container.state} />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('update')}
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    trigger();
                  }}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                </Button>
              }
            />
            <TooltipContent>{t('update')}</TooltipContent>
          </Tooltip>
          <ContainerTagPullButton containerId={container.id} currentImage={container.image} disabled={pending} />
          {StatusIconComponent && status && (
            <Tooltip>
              <TooltipTrigger className="ml-auto cursor-default">
                <StatusIconComponent className={`size-4 shrink-0 ${statusColor}`} />
              </TooltipTrigger>
              <TooltipContent>{statusLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>

      {pending && <div className="absolute inset-0 rounded-xl bg-green-500/10 pointer-events-none" />}
    </Card>
  );
}
