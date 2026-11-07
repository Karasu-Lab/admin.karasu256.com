'use client';

import { useState } from 'react';
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
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Spinner,
  toast,
} from '@karasu-lab/ui';
import { linkPackageAction } from '@/app/actions';
import type { InstallationRepository } from '@/lib/tenants';

const PAGE_SIZE = 10;

function pageItems(pageCount: number, currentPage: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
  const items: (number | 'ellipsis')[] = [];
  for (const page of sorted) {
    const previous = items[items.length - 1];
    if (typeof previous === 'number' && page - previous > 1) items.push('ellipsis');
    items.push(page);
  }
  return items;
}

export function RepositoryImport({
  organizationId,
  repositories,
  linkedFullNames,
  onRefresh,
  disabled,
  excludedFullNames,
}: {
  organizationId?: string;
  repositories: InstallationRepository[];
  linkedFullNames: string[];
  onRefresh?: () => Promise<void> | void;
  disabled?: boolean;
  excludedFullNames?: string[];
}) {
  const t = useTranslations('RepositoryImport');
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [justLinkedFullNames, setJustLinkedFullNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const candidates = repositories.filter((repository) => !excludedFullNames?.includes(repository.fullName));
  const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRepositories = candidates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const refresh = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      router.refresh();
    }
  };

  const link = async (repository: InstallationRepository) => {
    if (!organizationId) return;
    setBusyId(repository.id);
    try {
      const result = await linkPackageAction({
        organizationId,
        repositoryId: repository.id,
        repositoryFullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        private: repository.private,
      });
      setJustLinkedFullNames(result.linkedPackages.map((linked) => linked.repositoryFullName));
      await refresh();
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
      <CardContent>
        <Button disabled={disabled} onClick={() => setOpen(true)}>
          {t('add')}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPopup className="space-y-4 sm:max-w-lg">
              <DialogTitle>{t('title')}</DialogTitle>
              <div className="space-y-3">
                {!disabled && candidates.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
                {visibleRepositories.map((repository) => {
                  const linked = linkedFullNames.includes(repository.fullName) || justLinkedFullNames.includes(repository.fullName);
                  return (
                    <div key={repository.id} className="flex items-center gap-2 rounded-md border p-3">
                      <span className="min-w-0 font-medium break-words">{repository.fullName}</span>
                      {linked ? (
                        <Badge variant="secondary" className="ml-auto">
                          {t('linked')}
                        </Badge>
                      ) : (
                        <Button className="ml-auto" disabled={disabled || busyId === repository.id} onClick={() => link(repository)}>
                          {busyId === repository.id && <Spinner />}
                          {busyId === repository.id ? t('linking') : t('link')}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {pageCount > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          text={t('previous')}
                          href="#"
                          aria-disabled={currentPage === 1}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(Math.max(1, currentPage - 1));
                          }}
                        />
                      </PaginationItem>
                      {pageItems(pageCount, currentPage).map((item, index) =>
                        item === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              href="#"
                              isActive={item === currentPage}
                              onClick={(event) => {
                                event.preventDefault();
                                setPage(item);
                              }}
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          text={t('next')}
                          href="#"
                          aria-disabled={currentPage === pageCount}
                          className={currentPage === pageCount ? 'pointer-events-none opacity-50' : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(Math.min(pageCount, currentPage + 1));
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t('close')}
                </Button>
              </div>
            </DialogPopup>
          </DialogPortal>
        </Dialog>
      </CardContent>
    </Card>
  );
}
