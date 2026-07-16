'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Container, Image as ImageIcon, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavSidebar() {
  const t = useTranslations('Navigation');
  const pathname = usePathname();

  const items = [
    { href: '/', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/containers', label: t('containers'), icon: Container },
    { href: '/images', label: t('images'), icon: ImageIcon },
  ] as const;

  return (
    <aside className="flex flex-col w-56 min-h-screen border-r bg-background px-3 py-4 gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50',
            pathname === href && 'text-foreground'
          )}
        >
          {pathname === href && (
            <motion.div
              layoutId="nav-highlight"
              className="absolute inset-0 rounded-md bg-muted"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
          )}
          <Icon className="relative z-10 size-4" />
          <span className="relative z-10">{label}</span>
        </Link>
      ))}
    </aside>
  );
}
