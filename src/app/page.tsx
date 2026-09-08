import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@Hashibutogarasu/ui';
import { NavSidebar } from '@/components/nav-sidebar';
import { DeploymentsSection } from '@/components/deployments-section';
import { apiFetch } from '@/lib/api-fetch';
import { VercelConnectionStore, VercelDeploymentsClient } from '@/lib/vercel';

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  ports: unknown[];
}

interface ImageInfo {
  Id: string;
  RepoTags: string[];
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

async function fetchImages(): Promise<ImageInfo[]> {
  try {
    const res = await apiFetch('/api/images', { cache: 'no-store' });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as ImageInfo[]) : [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const t = await getTranslations('Dashboard');
  const [containers, images, vercelConnection] = await Promise.all([fetchContainers(), fetchImages(), new VercelConnectionStore().get()]);
  const deployments = vercelConnection ? await new VercelDeploymentsClient().listRecent(vercelConnection) : null;

  return (
    <div className="flex flex-1">
      <NavSidebar />
      <main className="flex-1 p-6 space-y-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('runningContainers')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{containers.filter((c) => c.state === 'running').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('availableImages')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{images.length}</p>
            </CardContent>
          </Card>
        </div>
        <DeploymentsSection connected={vercelConnection !== null} deployments={deployments} />
      </main>
    </div>
  );
}
