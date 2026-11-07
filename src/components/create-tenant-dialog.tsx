'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Dialog, DialogBackdrop, DialogPopup, DialogPortal, DialogTitle, Input, Label } from '@karasu-lab/ui';

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateTenantDialog({ open, onOpenChange }: CreateTenantDialogProps) {
  const t = useTranslations('Tenants');
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/auth/organization/create`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, slug }),
        }
      );
      if (!response.ok) throw new Error(await response.text());
      onOpenChange(false);
      setName('');
      setSlug('');
      setSlugEdited(false);
      router.refresh();
    } catch {
      setError(t('createError'));
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submit} disabled={submitting || !name || !slug}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
