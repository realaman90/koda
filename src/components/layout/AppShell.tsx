'use client';

import { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { BreadcrumbItem } from './Breadcrumbs';
import { cn } from '@/lib/utils';

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
  showSidebar = true,
  sidebarContent,
  className,
}: AppShellProps) {
  return (
    <div className={cn('flex flex-col h-screen bg-background', className)}>
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Navigation or Custom Content */}
        {showSidebar && (
          sidebarContent ? (
            <aside className="bg-background border-r border-border">
              {sidebarContent}
            </aside>
          ) : (
            <Sidebar />
          )
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
