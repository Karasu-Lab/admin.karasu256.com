import { getTranslations } from 'next-intl/server';
import { NavSidebar } from '@/components/nav-sidebar';
import { ContainerCard } from '@/components/container-card';
import { ContainersRefreshButton } from '@/components/containers-refresh-button';
import { apiFetch } from '@/lib/api-fetch';

interface ContainerPort {
  IP: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  ports: ContainerPort[];
}

async function fetchContainers(): Promise<ContainerInfo[]> {
  try {
    const res = await apiFetch('/api/containers', { cache: 'no-store' });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as ContainerInfo[]) : [];
  } catch {
    return [];
  }
}

export default async function ContainersPage() {
  const t = await getTranslations('Containers');
  const containers = await fetchContainers();

  return (
    <div className="flex flex-1">
      <NavSidebar />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <ContainersRefreshButton />
        </div>
        {containers.length === 0 ? (
          <p className="text-muted-foreground">{t('noContainers')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {containers.map((c) => (
              <ContainerCard key={c.id} container={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
