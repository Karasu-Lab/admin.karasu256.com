import { NavSidebar } from '@/components/nav-sidebar';
import { Skeleton } from '@Hashibutogarasu/ui';

function SkeletonSectionHeader() {
  return <Skeleton className="h-3 w-20 mt-4 mb-1" />;
}

function SkeletonInfoRow() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <Skeleton className="size-5 shrink-0 rounded-sm" />
      <Skeleton className="h-4 flex-1 max-w-xs" />
    </div>
  );
}

export default function ContainerDetailLoading() {
  return (
    <div className="flex flex-1">
      <NavSidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="h-8 w-40" />
          </div>
          <Skeleton className="size-9 rounded-md" />
        </div>

        <div className="max-w-xl">
          <SkeletonSectionHeader />
          <SkeletonInfoRow />
          <SkeletonInfoRow />
          <SkeletonInfoRow />
          <SkeletonInfoRow />

          <SkeletonSectionHeader />
          <SkeletonInfoRow />
          <SkeletonInfoRow />
        </div>
      </main>
    </div>
  );
}
