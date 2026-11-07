'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from '@karasu-lab/ui';
import { linkPackageAction } from '@/app/actions';
import type { InstallationRepository } from '@/lib/tenants';

export function RepositoryImport({
  organizationId,
  repositories,
  linkedFullNames,
  onRefresh,
}: {
  organizationId: string;
  repositories: InstallationRepository[];
  linkedFullNames: string[];
  onRefresh?: () => void;
}) {
  const t = useTranslations('RepositoryImport');
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      router.refresh();
    }
  };

  const link = async (repository: InstallationRepository) => {
    setBusyId(repository.id);
    try {
      await linkPackageAction({
        organizationId,
        repositoryId: repository.id,
        repositoryFullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        private: repository.private,
      });
      refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('linkError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {repositories.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {repositories.map((repository) => {
          const linked = linkedFullNames.includes(repository.fullName);
          return (
            <div key={repository.id} className="flex items-center gap-2 rounded-md border p-3">
              <span className="font-medium">{repository.fullName}</span>
              {linked ? (
                <Badge variant="secondary" className="ml-auto">
                  {t('linked')}
                </Badge>
              ) : (
                <Button className="ml-auto" disabled={busyId === repository.id} onClick={() => link(repository)}>
                  {busyId === repository.id ? t('linking') : t('link')}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
