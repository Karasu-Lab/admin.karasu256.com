import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { NavSidebar } from '@/components/nav-sidebar';
import { Badge, buttonVariants } from '@Hashibutogarasu/ui';
import { ContainerDetailSidebar } from '@/components/container-detail-sidebar';
import { ContainerUpdateButton } from '@/components/container-update-button';
import { apiFetch } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';
import { Activity, ArrowLeftRight, Box, Calendar, ChevronLeft, Code, FolderOpen, Hash, ScrollText } from 'lucide-react';

interface ContainerPort {
  [portProto: string]: Array<{ HostIp: string; HostPort: string }> | null;
}

interface ContainerMount {
  Source: string;
  Destination: string;
  Mode: string;
  Type: string;
}

interface ContainerInspectInfo {
  Id: string;
  Name: string;
  Created: string;
  State: {
    Status: string;
    Running: boolean;
  };
  Config: {
    Image: string;
    Env: string[] | null;
  };
  NetworkSettings: {
    Ports: ContainerPort;
  };
  Mounts: ContainerMount[];
}

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchContainer(id: string): Promise<ContainerInspectInfo | null> {
  try {
    const res = await apiFetch(`/api/containers/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ContainerInspectInfo;
  } catch {
    return null;
  }
}

function SectionHeader({ title }: { title: string }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-1">{title}</p>;
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <Icon className="size-5 text-muted-foreground shrink-0" aria-label={label} />
      <div className="flex-1 min-w-0 text-sm">{children}</div>
    </div>
  );
}

export default async function ContainerDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('ContainerDetail');
  const info = await fetchContainer(id);

  if (!info) {
    return (
      <div className="flex flex-1">
        <NavSidebar />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Link href="/containers" className="inline-flex items-center justify-center rounded-md p-2 text-sm hover:bg-muted transition-colors">
              <ChevronLeft className="size-4" />
            </Link>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-muted-foreground">{t('notFound')}</p>
        </main>
      </div>
    );
  }

  const displayName = info.Name.replace(/^\//, '');
  const ports = Object.entries(info.NetworkSettings.Ports ?? {});
  const shortId = info.Id.slice(0, 12);

  return (
    <div className="flex flex-1">
      <NavSidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link href="/containers" className="inline-flex items-center justify-center rounded-md p-2 text-sm hover:bg-muted transition-colors">
              <ChevronLeft className="size-4" />
            </Link>
            <h1 className="text-2xl font-bold">{displayName}</h1>
          </div>
          <div className="flex items-center gap-1">
            <ContainerUpdateButton containerId={id} />
            <Link href={`/containers/${id}/logs`} aria-label={t('viewLogs')} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
              <ScrollText className="size-4" />
            </Link>
          </div>
        </div>

        <div className="flex gap-6 items-stretch">
          <div className="flex-1 max-w-xl min-w-0">
            <SectionHeader title={t('status')} />

            <InfoRow icon={Activity} label={t('status')}>
              <Badge variant={info.State.Running ? 'default' : 'secondary'}>{info.State.Status}</Badge>
            </InfoRow>

            <InfoRow icon={Hash} label="ID">
              <span className="font-mono">{shortId}</span>
            </InfoRow>

            <InfoRow icon={Box} label={t('image')}>
              <span className="font-mono break-all">{info.Config.Image}</span>
            </InfoRow>

            <InfoRow icon={Calendar} label={t('created')}>
              {new Date(info.Created).toLocaleString()}
            </InfoRow>

            {ports.length > 0 && (
              <>
                <SectionHeader title={t('ports')} />
                {ports.map(([portProto, bindings]) => (
                  <InfoRow key={portProto} icon={ArrowLeftRight} label={portProto}>
                    <span className="font-mono">{bindings?.[0]?.HostPort ? `${bindings[0].HostPort} → ${portProto}` : portProto}</span>
                  </InfoRow>
                ))}
              </>
            )}

            {info.Mounts.length > 0 && (
              <>
                <SectionHeader title={t('mounts')} />
                {info.Mounts.map((m, i) => (
                  <InfoRow key={i} icon={FolderOpen} label={m.Destination}>
                    <span className="font-mono text-xs break-all text-muted-foreground">{m.Source}</span>
                  </InfoRow>
                ))}
              </>
            )}

            {info.Config.Env && info.Config.Env.length > 0 && (
              <>
                <SectionHeader title={t('environment')} />
                <div className="py-3 flex items-start gap-4 border-b border-border last:border-0">
                  <Code className="size-5 text-muted-foreground mt-1 shrink-0" aria-label={t('environment')} />
                  <div className="flex-1 min-w-0 space-y-1 max-h-56 overflow-y-auto">
                    {info.Config.Env.map((env, i) => (
                      <p key={i} className="text-xs font-mono text-muted-foreground break-all">
                        {env}
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <ContainerDetailSidebar containerId={id} />
        </div>
      </main>
    </div>
  );
}
