import { NavSidebar } from '@/components/nav-sidebar';
import { Skeleton } from '@Hashibutogarasu/ui';

export default function ContainersLoading() {
  return (
    <div className="flex flex-1">
      <NavSidebar />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-9" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
