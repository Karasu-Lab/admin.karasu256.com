'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Spinner,
  toast,
} from '@karasu-lab/ui';
import { Package, PackageCheck, Unlink, Workflow } from 'lucide-react';
import {
  getSetupDataAction,
  startNpmRepositorySetupAction,
  startTemplateRepositorySetupAction,
  unlinkNpmSetupAction,
  type SetupData,
} from '@/app/actions';
import { RepositorySetupForm } from './repository-setup-form';
import { SettingsItemContainer } from './settings/settings-item-container';
import { useReportLoading } from './settings/loading-context';
import { SigningKeyAuthorizationSection } from './signing-key-authorization-section';
import { SigningKeysSection } from './signing-keys-section';

export function SetupClient({
  tenantId,
  authApiUrl,
  appUrl,
}: {
  tenantId?: string;
  authApiUrl: string;
  appUrl: string;
}) {
  const tNpmSetup = useTranslations('NpmSetup');
  const [data, setData] = useState<SetupData | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getSetupDataAction(tenantId));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    }
  }, [tenantId]);

  const unlink = async () => {
    if (!data?.selected) return;
    setUnlinking(true);
    try {
      await unlinkNpmSetupAction(data.selected.id);
      setUnlinkConfirmOpen(false);
      await load();
    } catch {
      toast.error(tNpmSetup('unlinkError'));
    } finally {
      setUnlinking(false);
    }
  };

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const loading = !data;
  useReportLoading('setup', loading);
  const signedIn = data?.signedIn ?? false;
  const selected = data?.selected ?? null;
  const overview = data?.overview ?? null;
  const npmRepository = data?.npmRepository ?? null;
  const alreadyDone = Boolean(npmRepository?.npmRepositoryFullName && npmRepository?.workflowTemplateRepositoryFullName);
  const settingsUrl = selected ? `${appUrl}/setup?tenant=${selected.id}` : `${appUrl}/setup`;

  return (
    <main className="flex-1 space-y-6 p-6">
      {!loading && !signedIn && <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>}
      {!loading && signedIn && !selected && <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>}
      {!loading && selected && overview && !overview.installation && (
        <p className="text-muted-foreground">{tNpmSetup('noTenant')}</p>
      )}
      {selected && alreadyDone && (
        <SettingsItemContainer
          title={tNpmSetup('alreadyDone')}
          description={`${npmRepository?.npmRepositoryFullName ?? ''} · ${npmRepository?.workflowTemplateRepositoryFullName ?? ''}`}
          icon={PackageCheck}
          iconBackgroundColor="#34c759"
        >
          <div className="space-y-3">
            <Button variant="destructive" onClick={() => setUnlinkConfirmOpen(true)}>
              <Unlink />
              {tNpmSetup('unlink')}
            </Button>
            <Dialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
              <DialogPortal>
                <DialogBackdrop />
                <DialogPopup className="space-y-4">
                  <DialogTitle>{tNpmSetup('unlinkConfirmTitle')}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {tNpmSetup('unlinkConfirmDescription', {
                      npmRepository: npmRepository?.npmRepositoryFullName ?? '',
                      templateRepository: npmRepository?.workflowTemplateRepositoryFullName ?? '',
                    })}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setUnlinkConfirmOpen(false)} disabled={unlinking}>
                      {tNpmSetup('cancel')}
                    </Button>
                    <Button variant="destructive" onClick={unlink} disabled={unlinking}>
                      {unlinking && <Spinner />}
                      {unlinking ? tNpmSetup('unlinking') : tNpmSetup('unlink')}
                    </Button>
                  </div>
                </DialogPopup>
              </DialogPortal>
            </Dialog>
          </div>
        </SettingsItemContainer>
      )}
      {(loading || (selected && overview?.installation)) && (
        <>
          <RepositorySetupForm
            title={tNpmSetup('title')}
            description={tNpmSetup('npmDescription')}
            nameLabel={tNpmSetup('npmRepositoryName')}
            nameFieldId="npm-repository-name"
            organizationId={selected?.id ?? ''}
            owner={overview?.installation?.targetLogin}
            existingRepositories={data?.repositories ?? []}
            initialRepositoryName={npmRepository?.npmRepositoryName}
            defaultRepositoryName="npm"
            disabled={loading}
            onRefresh={load}
            startSetup={({ organizationId, repositoryName }) =>
              startNpmRepositorySetupAction({ organizationId, npmRepositoryName: repositoryName })
            }
            icon={Package}
            iconBackgroundColor="#cb3837"
          />
          <RepositorySetupForm
            title={tNpmSetup('templateTitle')}
            description={tNpmSetup('templateDescription')}
            nameLabel={tNpmSetup('templateRepositoryName')}
            nameFieldId="template-repository-name"
            organizationId={selected?.id ?? ''}
            owner={overview?.installation?.targetLogin}
            existingRepositories={data?.repositories ?? []}
            initialRepositoryName={npmRepository?.workflowTemplateRepositoryName}
            defaultRepositoryName="workflow-templates"
            disabled={loading}
            onRefresh={load}
            startSetup={({ organizationId, repositoryName }) =>
              startTemplateRepositorySetupAction({ organizationId, templateRepositoryName: repositoryName })
            }
            icon={Workflow}
            iconBackgroundColor="#6e5494"
          />
        </>
      )}
      {(loading || selected) && (
        <>
          <SigningKeyAuthorizationSection authApiUrl={authApiUrl} settingsUrl={settingsUrl} disabled={loading} />
          <SigningKeysSection authApiUrl={authApiUrl} keys={overview?.signingKeys ?? []} disabled={loading} onRefresh={load} />
        </>
      )}
    </main>
  );
}
