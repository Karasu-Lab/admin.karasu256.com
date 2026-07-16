'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PullProgress } from '@/components/pull-progress';
import { Button, Input, Label } from '@Hashibutogarasu/ui';

interface ImagePullFormProps {
  onDone: () => void;
}

export function ImagePullForm({ onDone }: ImagePullFormProps) {
  const t = useTranslations('Images');
  const [pullImage, setPullImage] = useState('');
  const [pulling, setPulling] = useState(false);
  const [activePull, setActivePull] = useState<string | null>(null);

  const handlePull = () => {
    if (!pullImage.trim()) return;
    setActivePull(pullImage.trim());
    setPulling(true);
  };

  const handlePullDone = () => {
    setPulling(false);
    setActivePull(null);
    setPullImage('');
    onDone();
  };

  return (
    <div className="space-y-2 max-w-sm">
      <div>
        <Label htmlFor="pull-image">{t('pull.image')}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{t('pull.description')}</p>
      </div>
      <div className="flex gap-2">
        <Input
          id="pull-image"
          placeholder={t('pull.imagePlaceholder')}
          value={pullImage}
          onChange={(e) => setPullImage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePull()}
          disabled={pulling}
        />
        <Button onClick={handlePull} disabled={pulling || !pullImage.trim()}>
          {t('pull.start')}
        </Button>
      </div>
      {activePull && <PullProgress imageName={activePull} onDone={handlePullDone} />}
    </div>
  );
}
