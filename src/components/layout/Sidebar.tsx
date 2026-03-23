'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home,
  FolderOpen,
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
    icon: FolderOpen,
    label: 'Projects',
    href: '/?tab=my-spaces',
    tab: 'my-spaces',
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
  const [isExpanded, setIsExpanded] = useState(false);

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
        'bg-background border-r border-border flex flex-col transition-all duration-200',
        isExpanded ? 'w-48' : 'w-16',
        className
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-1 p-2 pt-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                'hover:bg-muted',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap overflow-hidden transition-opacity duration-200',
                  isExpanded ? 'opacity-100' : 'opacity-0 w-0'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Expand/Collapse Toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-center w-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
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
