'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner, toast } from '@karasu-lab/ui';
import { startProviderLink } from '@/lib/provider-link';

export function SigningKeyAuthorizationSection({
  authApiUrl,
  settingsUrl,
  disabled,
}: {
  authApiUrl: string;
  settingsUrl: string;
  disabled?: boolean;
}) {
  const t = useTranslations('SigningKeys');
  const [authorizing, setAuthorizing] = useState(false);

  const authorize = async () => {
    setAuthorizing(true);
    try {
      await startProviderLink(authApiUrl, 'github-oauth-app', settingsUrl);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('actionError'));
      setAuthorizing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('authorizationTitle')}</CardTitle>
        <CardDescription>{t('authorizationDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" disabled={disabled || authorizing} onClick={authorize}>
          {authorizing && <Spinner />}
          {t('authorize')}
        </Button>
      </CardContent>
    </Card>
  );
}
