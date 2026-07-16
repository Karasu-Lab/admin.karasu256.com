'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NavSidebar } from '@/components/nav-sidebar';
import { ImagePullForm } from '@/components/image-pull-form';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from '@Hashibutogarasu/ui';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';

interface ImageInfo {
  Id: string;
  RepoTags: string[] | null;
  Size: number;
  Created: number;
}

interface EditTarget {
  imageId: string;
  repo: string;
  tag: string;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString();
}

function shortId(id: string): string {
  return id.replace('sha256:', '').slice(0, 12);
}

export default function ImagesPage() {
  const t = useTranslations('Images');
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editRepo, setEditRepo] = useState('');
  const [editTag, setEditTag] = useState('');

  const loadImages = async () => {
    try {
      const res = await fetch('/api/images');
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (Array.isArray(data)) setImages(data as ImageInfo[]);
    } catch {
      return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadImages();
  }, []);

  const handleDelete = async (img: ImageInfo) => {
    if (!window.confirm(t('deleteConfirm'))) return;
    await fetch(`/api/images/${shortId(img.Id)}`, { method: 'DELETE' });
    void loadImages();
  };

  const openEditTag = (img: ImageInfo, repo: string, tag: string) => {
    setEditTarget({ imageId: img.Id, repo, tag });
    setEditRepo(repo);
    setEditTag(tag);
  };

  const handleTagSave = async () => {
    if (!editTarget) return;
    await fetch(`/api/images/${shortId(editTarget.imageId)}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: editRepo, tag: editTag }),
    });
    setEditTarget(null);
    void loadImages();
  };

  return (
    <div className="flex flex-1">
      <NavSidebar />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <Button size="icon" variant="ghost" aria-label={t('refresh')} onClick={() => void loadImages()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>

        <ImagePullForm onDone={() => void loadImages()} />

        {loading && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('repository')}</TableHead>
                <TableHead>{t('tag')}</TableHead>
                <TableHead>{t('size')}</TableHead>
                <TableHead>{t('created')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-7 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && images.length === 0 && <p className="text-muted-foreground">{t('noImages')}</p>}

        {!loading && images.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('repository')}</TableHead>
                <TableHead>{t('tag')}</TableHead>
                <TableHead>{t('size')}</TableHead>
                <TableHead>{t('created')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.map((img) => {
                const tags = img.RepoTags ?? ['<none>:<none>'];
                return tags.map((rawTag) => {
                  const [repo, tagPart] = rawTag.split(':');
                  return (
                    <TableRow key={`${img.Id}-${rawTag}`}>
                      <TableCell className="font-mono text-xs">{repo}</TableCell>
                      <TableCell className="font-mono text-xs">{tagPart}</TableCell>
                      <TableCell className="text-xs">{formatBytes(img.Size)}</TableCell>
                      <TableCell className="text-xs">{formatDate(img.Created)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" aria-label={t('editTag')} onClick={() => openEditTag(img, repo, tagPart)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={t('delete')} onClick={() => void handleDelete(img)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                });
              })}
            </TableBody>
          </Table>
        )}
      </main>

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editTagDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-repo">{t('editTagDialog.repo')}</Label>
              <Input id="edit-repo" value={editRepo} onChange={(e) => setEditRepo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-tag">{t('editTagDialog.tag')}</Label>
              <Input id="edit-tag" value={editTag} onChange={(e) => setEditTag(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              {t('editTagDialog.cancel')}
            </Button>
            <Button onClick={() => void handleTagSave()} disabled={!editRepo.trim() || !editTag.trim()}>
              {t('editTagDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
