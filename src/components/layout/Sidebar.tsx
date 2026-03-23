'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home,
  LayoutTemplate,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  tab?: string; // Tab parameter to match
}

const navItems: NavItem[] = [
  {
    icon: Home,
    label: 'Home',
    href: '/',
  },
  {
    icon: LayoutTemplate,
    label: 'Templates',
    href: '/?tab=templates',
    tab: 'templates',
  },
  {
    icon: Settings,
    label: 'Settings',
    href: '/settings',
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem('koda:sidebar-expanded');
    return saved === null ? true : saved === 'true';
  });

  const currentTab = searchParams.get('tab');

  const isActive = (item: NavItem) => {
    // For non-root paths, check pathname
    if (item.href.startsWith('/') && !item.href.startsWith('/?')) {
      return pathname === item.href || pathname.startsWith(item.href + '/');
    }

    // For root path with tabs
    if (pathname === '/') {
      // Home is active when no tab param or explicitly on home
      if (item.href === '/' && !item.tab) {
        return !currentTab;
      }
      // Tab items are active when their tab matches
      if (item.tab) {
        return currentTab === item.tab;
      }
    }

    return false;
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/70 bg-background transition-all duration-250',
        isExpanded ? 'w-60' : 'w-20',
        className
      )}
    >
      <div className={cn('px-3 pt-3 pb-2', isExpanded ? 'opacity-100' : 'opacity-0')}>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1.5 px-2 pb-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <Link
              key={item.label}
              href={item.href}
              title={!isExpanded ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
                active
                  ? 'border-border/80 bg-muted/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                  active
                    ? 'border-border bg-background text-foreground'
                    : 'border-border/60 bg-background/80 text-muted-foreground group-hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
              </span>
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-200',
                  isExpanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Expand / Collapse */}
      <div className="border-t border-border/70 p-2">
        <button
          onClick={() => {
            const next = !isExpanded;
            setIsExpanded(next);
            window.localStorage.setItem('koda:sidebar-expanded', String(next));
          }}
          className="flex w-full items-center justify-center rounded-xl border border-transparent p-2.5 text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/60 hover:text-foreground"
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
