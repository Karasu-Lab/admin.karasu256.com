'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@Hashibutogarasu/ui';
import { Play, Square } from 'lucide-react';

interface ContainerToggleButtonProps {
  containerId: string;
  state: string;
}

export function ContainerToggleButton({ containerId, state }: ContainerToggleButtonProps) {
  const t = useTranslations('Containers');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isRunning = state === 'running';

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPending(true);
    const action = isRunning ? 'stop' : 'start';
    await fetch(`/api/containers/${containerId}/${action}`, { method: 'POST' });
    router.refresh();
    setPending(false);
  };

  const label = isRunning ? t('stop') : t('start');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size="icon" variant="ghost" aria-label={label} disabled={pending} onClick={(e) => void handleClick(e)}>
            {isRunning ? <Square className="size-4" /> : <Play className="size-4" />}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
