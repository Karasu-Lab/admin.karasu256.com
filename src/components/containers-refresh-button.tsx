'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@Hashibutogarasu/ui';
import { RefreshCw } from 'lucide-react';

export function ContainersRefreshButton() {
  const t = useTranslations('Containers');
  const router = useRouter();
  return (
    <Button size="icon" variant="ghost" aria-label={t('refresh')} onClick={() => router.refresh()}>
      <RefreshCw className="size-4" />
    </Button>
  );
}
