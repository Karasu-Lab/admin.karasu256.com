'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input, Label, Spinner, toast } from '@karasu-lab/ui';
import { Package, Plus, RefreshCw, type LucideIcon } from 'lucide-react';
import type { RepositorySetupOutcome } from '@/app/actions';
import type { InstallationRepository } from '@/lib/tenants';
import { SettingsItemContainer } from './settings/settings-item-container';

type RepositoryPlan = 'create' | 'overwrite' | 'blocked';

export function RepositorySetupForm({
  title,
  description,
  nameLabel,
  nameFieldId,
  organizationId,
  owner,
  existingRepositories,
  initialRepositoryName,
  defaultRepositoryName,
  disabled,
  onRefresh,
  startSetup,
  icon,
  iconBackgroundColor,
}: {
  title: string;
  description: string;
  nameLabel: string;
  nameFieldId: string;
  organizationId: string;
  owner?: string;
  existingRepositories: InstallationRepository[];
  initialRepositoryName?: string;
  defaultRepositoryName: string;
  disabled?: boolean;
  onRefresh?: () => Promise<void> | void;
  startSetup: (input: { organizationId: string; repositoryName: string }) => Promise<{ outcome: RepositorySetupOutcome }>;
  icon?: LucideIcon;
  iconBackgroundColor?: string;
}) {
  const t = useTranslations('NpmSetup');
  const router = useRouter();
  const [name, setName] = useState(initialRepositoryName ?? defaultRepositoryName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(initialRepositoryName ?? defaultRepositoryName);
  }, [initialRepositoryName, defaultRepositoryName]);

  const plan: { plan: RepositoryPlan; fullName: string } | null = (() => {
    if (disabled || !owner || !name) return null;
    const fullName = `${owner}/${name}`;
    const existing = existingRepositories.find(
      (repository) => repository.fullName.toLowerCase() === fullName.toLowerCase()
    );
    if (!existing) return { plan: 'create', fullName };
    return { plan: existing.private ? 'blocked' : 'overwrite', fullName: existing.fullName };
  })();

  const planText = (entry: { plan: RepositoryPlan; fullName: string }): string => {
    if (entry.plan === 'create') return t('willCreate', { fullName: entry.fullName });
    if (entry.plan === 'overwrite') return t('willOverwrite', { fullName: entry.fullName });
    return t('cannotOverwritePrivate', { fullName: entry.fullName });
  };

  const start = async () => {
    setBusy(true);
    try {
      const result = await startSetup({ organizationId, repositoryName: name });
      toast.success(result.outcome === 'overwritten' ? t('doneOverwritten') : t('done'));
      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsItemContainer title={title} description={description} icon={icon ?? Package} iconBackgroundColor={iconBackgroundColor}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={nameFieldId}>{nameLabel}</Label>
          <Input id={nameFieldId} value={name} disabled={disabled} onChange={(event) => setName(event.target.value)} />
          {plan && <p className="text-sm text-muted-foreground">{planText(plan)}</p>}
        </div>
        <Button onClick={start} disabled={disabled || busy || plan?.plan === 'blocked' || !name}>
          {busy ? <Spinner /> : plan?.plan === 'overwrite' ? <RefreshCw /> : <Plus />}
          {plan?.plan === 'overwrite' ? t('overwriteShort') : t('createShort')}
        </Button>
      </div>
    </SettingsItemContainer>
  );
}
