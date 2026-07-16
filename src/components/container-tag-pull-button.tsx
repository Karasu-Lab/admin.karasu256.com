'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from '@Hashibutogarasu/ui';
import { triggerPullUpdate } from '@/lib/update-stream';

interface ContainerTagPullButtonProps {
  containerId: string;
  currentImage: string;
  disabled?: boolean;
}

export function ContainerTagPullButton({ containerId, currentImage, disabled = false }: ContainerTagPullButtonProps) {
  const t = useTranslations('Containers');
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = currentImage.split(':')[1] ?? 'latest';

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      triggerPullUpdate(containerId, tag || undefined);
      setOpen(false);
      setTag('');
    } else if (e.key === 'Escape') {
      setOpen(false);
      setTag('');
    }
  };

  const handleBlur = () => {
    setOpen(false);
    setTag('');
  };

  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="tag-input"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 112, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden mr-1"
            onAnimationComplete={() => open && inputRef.current?.focus()}
          >
            <Input
              ref={inputRef}
              value={tag}
              placeholder={placeholder}
              className="h-8 text-xs"
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button size="icon" variant="ghost" aria-label={t('pullWithTag')} disabled={disabled} onClick={handleOpen}>
              <Download className="size-4" />
            </Button>
          }
        />
        <TooltipContent>{t('pullWithTag')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
