'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Input,
  Label,
  Spinner,
  Switch,
  toast,
} from '@karasu-lab/ui';
import type { UserSigningKey } from '@/lib/tenants';

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
    <Card>
      <CardHeader>
        <CardTitle>{t('registrationTitle')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            {busy && <Spinner />}
            {busy ? t('creating') : t('create')}
          </Button>
        </div>
        <div className="space-y-4">
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
        </div>
      </CardContent>
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
    </Card>
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
  const [name, setName] = useState(signingKey.name);
  return (
    <div className="space-y-2 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} className="max-w-xs" />
        <Button variant="outline" onClick={() => onRename(name)} disabled={busy || !sessionReady || !name || name === signingKey.name}>
          {t('rename')}
        </Button>
        <Button variant="outline" onClick={onRotate} disabled={busy || !sessionReady}>
          {t('rotate')}
        </Button>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {t('enabled')}
          <Switch checked={signingKey.enabled} onCheckedChange={onToggle} disabled={busy || !sessionReady} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={signingKey.registeredOnGitHub ? 'default' : 'secondary'}>
          {signingKey.registeredOnGitHub ? t('registered') : t('notRegistered')}
        </Badge>
      </div>
      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">{signingKey.publicKey}</pre>
    </div>
  );
}
