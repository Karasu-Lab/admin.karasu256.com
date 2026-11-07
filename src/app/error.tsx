'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, toast } from '@karasu-lab/ui';

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations('Common');

  useEffect(() => {
    toast.error(error.message);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Button onClick={() => unstable_retry()}>{t('retry')}</Button>
    </div>
  );
}
