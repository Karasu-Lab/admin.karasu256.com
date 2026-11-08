'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Button,
  Checkbox,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuTrigger,
  Input,
  Label,
  Spinner,
  Switch,
  toast,
} from '@karasu-lab/ui';
import { KeyRound, MoreHorizontal, Pencil, Plus, RefreshCw } from 'lucide-react';
import type { UserSigningKey } from '@/lib/tenants';
import { SettingsItemContainer, SettingsItemGroup } from './settings/settings-item-container';

interface SigningKeysSectionProps {
  authApiUrl: string;
  keys: UserSigningKey[];
  disabled?: boolean;
  onRefresh?: () => void;
}

interface SessionResponse {
  session?: { id?: string } | null;
}

export function SigningKeysSection({ authApiUrl, keys, disabled, onRefresh }: SigningKeysSectionProps) {
  const t = useTranslations('SigningKeys');
  const router = useRouter();
  const refresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      router.refresh();
    }
  };
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${authApiUrl}/api/auth/get-session`, { credentials: 'include' });
        const data = (await response.json().catch(() => null)) as SessionResponse | null;
        if (!cancelled) setSessionId(data?.session?.id ?? null);
      } catch {
        if (!cancelled) setSessionId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authApiUrl]);

  const call = async (path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await fetch(`${authApiUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, ...body }),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `http_${response.status}`);
    return data;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('actionError'));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const data = await call('/api/signing-keys', { name: newName });
      setNewName('');
      if (typeof data.privateKey === 'string') {
        setSaved(false);
        setPrivateKey(data.privateKey);
      } else {
        refresh();
      }
    });

  const rotate = (keyId: string) =>
    run(async () => {
      const data = await call(`/api/signing-keys/${keyId}/rotate`);
      setSaved(false);
      setPrivateKey(typeof data.privateKey === 'string' ? data.privateKey : null);
    });

  const rename = (keyId: string, name: string) =>
    run(async () => {
      await call(`/api/signing-keys/${keyId}/rename`, { name });
      refresh();
    });

  const setEnabled = (keyId: string, enabled: boolean) =>
    run(async () => {
      await call(`/api/signing-keys/${keyId}/enabled`, { enabled });
      refresh();
    });

  return (
    <SettingsItemContainer title={t('registrationTitle')} description={t('description')} icon={KeyRound} iconBackgroundColor="#ff9500">
      <div className="space-y-6">
        {sessionId === null && <p className="text-sm text-muted-foreground">{t('sessionLoading')}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <Input
            placeholder={t('name')}
            value={newName}
            disabled={disabled}
            onChange={(event) => setNewName(event.target.value)}
            className="max-w-xs"
          />
          <Button onClick={create} disabled={disabled || busy || !sessionId || !newName}>
            {busy ? <Spinner /> : <Plus />}
            {t('createShort')}
          </Button>
        </div>
        {keys.length > 0 && (
          <SettingsItemGroup>
            {keys.map((key) => (
              <KeyRow
                key={key.id}
                signingKey={key}
                busy={busy || Boolean(disabled)}
                sessionReady={Boolean(sessionId)}
                onRotate={() => rotate(key.id)}
                onRename={(name) => rename(key.id, name)}
                onToggle={(enabled) => setEnabled(key.id, enabled)}
              />
            ))}
          </SettingsItemGroup>
        )}
      </div>
      <Dialog
        open={privateKey !== null}
        onOpenChange={(open) => {
          if (!open && saved) {
            setPrivateKey(null);
            refresh();
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="space-y-4">
            <DialogTitle>{t('privateKeyTitle')}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t('privateKeyDescription')}</p>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">
              {privateKey}
            </pre>
            <div className="flex items-center gap-2">
              <Checkbox id="private-key-saved" checked={saved} onCheckedChange={(checked) => setSaved(checked === true)} />
              <Label htmlFor="private-key-saved">{t('privateKeySaved')}</Label>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!saved}
                onClick={() => {
                  setPrivateKey(null);
                  refresh();
                }}
              >
                {t('close')}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </SettingsItemContainer>
  );
}

function KeyRow({
  signingKey,
  busy,
  sessionReady,
  onRotate,
  onRename,
  onToggle,
}: {
  signingKey: UserSigningKey;
  busy: boolean;
  sessionReady: boolean;
  onRotate: () => void;
  onRename: (name: string) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const t = useTranslations('SigningKeys');
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(signingKey.name);
  const actionsDisabled = busy || !sessionReady;

  return (
    <SettingsItemContainer
      title={signingKey.name}
      icon={KeyRound}
      trailing={
        <span className="flex items-center gap-1">
          <Switch checked={signingKey.enabled} onCheckedChange={onToggle} disabled={actionsDisabled} aria-label={t('enabled')} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="icon" variant="ghost" aria-label={t('menu')}>
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuPortal>
              <DropdownMenuPositioner align="end" side="bottom" sideOffset={4}>
                <DropdownMenuPopup>
                  <DropdownMenuItem
                    disabled={actionsDisabled}
                    onClick={() => {
                      setName(signingKey.name);
                      setRenameOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    {t('rename')}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={actionsDisabled} onClick={onRotate}>
                    <RefreshCw className="size-4" />
                    {t('rotate')}
                  </DropdownMenuItem>
                </DropdownMenuPopup>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenu>
        </span>
      }
    >
      <div className="space-y-2">
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">{signingKey.publicKey}</pre>
      </div>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="space-y-4">
            <DialogTitle>{t('rename')}</DialogTitle>
            <div className="space-y-2">
              <Label htmlFor={`rename-signing-key-${signingKey.id}`}>{t('name')}</Label>
              <Input
                id={`rename-signing-key-${signingKey.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                disabled={!name || name === signingKey.name}
                onClick={() => {
                  onRename(name);
                  setRenameOpen(false);
                }}
              >
                {t('save')}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </SettingsItemContainer>
  );
}
