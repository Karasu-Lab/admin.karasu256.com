'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Dialog, DialogBackdrop, DialogPopup, DialogPortal, DialogTitle, Input, Label, Spinner, toast } from '@karasu-lab/ui';

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authApiUrl: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateTenantDialog({ open, onOpenChange, authApiUrl }: CreateTenantDialogProps) {
  const t = useTranslations('Tenants');
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(
        `${authApiUrl}/api/auth/organization/create`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, slug }),
        }
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: unknown; error?: unknown } | null;
        throw new Error(
          (typeof data?.message === 'string' && data.message) ||
            (typeof data?.error === 'string' && data.error) ||
            `http_${response.status}`
        );
      }
      onOpenChange(false);
      setName('');
      setSlug('');
      setSlugEdited(false);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4">
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <div className="space-y-2">
            <Label htmlFor="tenant-name">{t('name')}</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">{t('slug')}</Label>
            <Input
              id="tenant-slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submit} disabled={submitting || !name || !slug}>
              {submitting && <Spinner />}
              {submitting ? t('creating') : t('create')}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
