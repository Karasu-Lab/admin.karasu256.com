'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Spinner, toast } from '@karasu-lab/ui';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { startProviderLink } from '@/lib/provider-link';
import { SettingsItemContainer } from './settings/settings-item-container';

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
    <SettingsItemContainer
      title={t('authorizationTitle')}
      description={t('authorizationDescription')}
      icon={ShieldCheck}
      iconBackgroundColor="#5856d6"
    >
      <Button variant="outline" disabled={disabled || authorizing} onClick={authorize}>
        {authorizing ? <Spinner /> : <KeyRound />}
        {t('authorizeShort')}
      </Button>
    </SettingsItemContainer>
  );
}
