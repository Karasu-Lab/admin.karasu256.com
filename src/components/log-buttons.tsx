'use client';

import { Lock, Unlock, Copy, Eraser, Maximize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Tooltip, TooltipTrigger, TooltipContent } from '@Hashibutogarasu/ui';

interface CompactProp {
  compact?: boolean;
}

function useSizes(compact: boolean) {
  return {
    btn: compact ? 'size-6' : undefined,
    icon: compact ? 'size-3.5' : 'size-4',
  } as const;
}

export function LogAutoScrollButton({
  autoScroll,
  onChange,
  compact = false,
}: CompactProp & { autoScroll: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations('Logs');
  const { btn, icon } = useSizes(compact);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon"
            variant={autoScroll ? 'secondary' : 'ghost'}
            className={btn}
            aria-label={t('autoScroll')}
            onClick={() => onChange(!autoScroll)}
          >
            {autoScroll ? <Lock className={icon} /> : <Unlock className={icon} />}
          </Button>
        }
      />
      <TooltipContent>{t('autoScroll')}</TooltipContent>
    </Tooltip>
  );
}

export function LogCopyButton({ lines, compact = false }: CompactProp & { lines: string[] }) {
  const t = useTranslations('Logs');
  const { btn, icon } = useSizes(compact);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(lines.join('\n'));
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size="icon" variant="ghost" className={btn} aria-label={t('copyAll')} onClick={() => void handleCopy()}>
            <Copy className={icon} />
          </Button>
        }
      />
      <TooltipContent>{t('copyAll')}</TooltipContent>
    </Tooltip>
  );
}

export function LogClearButton({ onClear, compact = false }: CompactProp & { onClear: () => void }) {
  const t = useTranslations('Logs');
  const { btn, icon } = useSizes(compact);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size="icon" variant="ghost" className={btn} aria-label={t('clear')} onClick={onClear}>
            <Eraser className={icon} />
          </Button>
        }
      />
      <TooltipContent>{t('clear')}</TooltipContent>
    </Tooltip>
  );
}

export function LogMaximizeButton({ onClick, compact = false }: CompactProp & { onClick: () => void }) {
  const t = useTranslations('Logs');
  const { btn, icon } = useSizes(compact);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size="icon" variant="ghost" className={btn} aria-label={t('maximize')} onClick={onClick}>
            <Maximize2 className={icon} />
          </Button>
        }
      />
      <TooltipContent>{t('maximize')}</TooltipContent>
    </Tooltip>
  );
}
