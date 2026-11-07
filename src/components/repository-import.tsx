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
}: {
  organizationId: string;
  repositories: InstallationRepository[];
  linkedFullNames: string[];
  onRefresh?: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations('RepositoryImport');
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(repositories.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRepositories = repositories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
        {!disabled && repositories.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {visibleRepositories.map((repository) => {
          const linked = linkedFullNames.includes(repository.fullName);
          return (
            <div key={repository.id} className="flex items-center gap-2 rounded-md border p-3">
              <span className="font-medium">{repository.fullName}</span>
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
      </CardContent>
    </Card>
  );
}
