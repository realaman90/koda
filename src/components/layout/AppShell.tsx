'use client';

import { ReactNode, useSyncExternalStore } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { AnnouncementNotifications } from './AnnouncementNotifications';
import { BreadcrumbItem } from './Breadcrumbs';
import { KodaLogo } from '@/components/ui/KodaLogo';
import { cn } from '@/lib/utils';
import { Monitor, MousePointer2, Sparkles, Workflow } from 'lucide-react';

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
};

function detectMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const nav = navigator as NavigatorWithUserAgentData;
  const userAgent = navigator.userAgent || '';
  const isIpadOsDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isMobileUserAgent = Boolean(nav.userAgentData?.mobile)
    || /Android.+Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(userAgent);
  const isTabletUserAgent = isIpadOsDesktopMode
    || /iPad|Tablet|PlayBook|Silk|Kindle/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));

  return isMobileUserAgent || isTabletUserAgent;
}

function subscribeToDeviceChanges(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  window.addEventListener('resize', onStoreChange);
  window.addEventListener('orientationchange', onStoreChange);

  return () => {
    window.removeEventListener('resize', onStoreChange);
    window.removeEventListener('orientationchange', onStoreChange);
  };
}

interface AppShellProps {
  children: ReactNode;
  mode?: 'dashboard' | 'canvas';
  // TopBar props for dashboard mode
  breadcrumbs?: BreadcrumbItem[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // TopBar props for canvas mode
  canvasName?: string;
  onCanvasNameChange?: (name: string) => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  lastSavedAt?: number | null;
  onExportJSON?: () => void;
  onExportPNG?: () => void;
  onExportAllAssets?: () => void;
  onExportSelectedAssets?: () => void;
  // Sidebar control
  showSidebar?: boolean;
  sidebarContent?: ReactNode;
  className?: string;
}

export function AppShell({
  children,
  mode = 'dashboard',
  breadcrumbs,
  searchQuery,
  onSearchChange,
  canvasName,
  onCanvasNameChange,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  onExportJSON,
  onExportPNG,
  onExportAllAssets,
  onExportSelectedAssets,
  showSidebar = true,
  sidebarContent,
  className,
}: AppShellProps) {
  const showMobileRecommendation = useSyncExternalStore(
    subscribeToDeviceChanges,
    detectMobileOrTabletDevice,
    () => false
  );

  const mobileTitle = mode === 'canvas'
    ? 'Canvas editing is built for desktop'
    : 'Desktop recommended for the Koda workspace';
  const mobileDescription = mode === 'canvas'
    ? 'Open this canvas on a laptop or desktop to edit nodes, inspect media, and export generated assets reliably.'
    : 'Koda works best on a larger screen. Use a laptop or desktop to manage canvases, review outputs, and work across your workflow without the mobile friction.';

  if (showMobileRecommendation) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center bg-background px-6 py-8', className)}>
        <section className="w-full max-w-md">
          <div className="relative mx-auto flex w-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_70%)]" />
            <div className="relative flex flex-col gap-6 p-6">
              <div className="flex items-center justify-between">
                <KodaLogo variant="full" size="md" />
                <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Desktop
                </span>
              </div>

              <div className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-primary shadow-sm">
                  <Monitor className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold leading-tight text-foreground">
                    {mobileTitle}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {mobileDescription}
                  </p>
                </div>
                {mode === 'canvas' && canvasName ? (
                  <div className="inline-flex max-w-full items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="truncate">Current canvas: {canvasName}</span>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3">
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                  <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Large-screen workflow</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      Node editing, compare trays, and multi-step generation flows need more space than a phone or tablet can provide.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                  <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Better controls</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      Desktop gives you precise drag, resize, and selection behavior across the canvas.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Reliable exports</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      Generated images, videos, and media exports are easier to review and download from a computer.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs leading-5 text-muted-foreground">
                Open Koda on a laptop or desktop browser for the recommended experience.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={cn('flex h-screen flex-col bg-background', className)}>
      {/* Top Bar */}
      <TopBar
        mode={mode}
        breadcrumbs={breadcrumbs}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        canvasName={canvasName}
        onCanvasNameChange={onCanvasNameChange}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
        onExportJSON={onExportJSON}
        onExportPNG={onExportPNG}
        onExportAllAssets={onExportAllAssets}
        onExportSelectedAssets={onExportSelectedAssets}
      />

      <AnnouncementNotifications mode={mode} />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Navigation or Custom Content */}
        {showSidebar && (
          sidebarContent ? (
            <aside className="border-r border-border/70 bg-background/90 backdrop-blur">
              {sidebarContent}
            </aside>
          ) : (
            <Sidebar />
          )
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_45%)]">
          {children}
        </main>
      </div>
    </div>
  );
}
