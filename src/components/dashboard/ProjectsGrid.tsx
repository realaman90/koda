'use client';

import { AlertCircle, Sparkles } from 'lucide-react';
import { CanvasCard } from './CanvasCard';
import { StaggeredList, StaggerItem } from '@/components/common/StaggeredList';
import type { CanvasMetadata } from '@/lib/storage';

interface ProjectsGridProps {
  canvases: CanvasMetadata[];
  isLoading: boolean;
  loadError?: string | null;
  searchQuery: string;
  onCreateCanvas: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRefreshPreview?: (id: string) => void;
  onRetryLoad?: () => void;
  onBrowseTemplates?: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-video animate-pulse bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectsGrid({
  canvases,
  isLoading,
  loadError,
  searchQuery,
  onCreateCanvas,
  onRename,
  onDuplicate,
  onDelete,
  onRefreshPreview,
  onRetryLoad,
  onBrowseTemplates,
}: ProjectsGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-6 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-7 w-7 text-amber-400" />
        <p className="text-base font-medium text-foreground">Couldn’t load your projects</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{loadError}</p>
        <button
          onClick={onRetryLoad}
          className="mt-5 rounded-lg bg-[#3b82f6] px-4 py-2 text-white transition-colors hover:bg-[#2563eb]"
        >
          Retry loading projects
        </button>
      </div>
    );
  }

  if (canvases.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-6 py-16 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#3b82f6]" />
        <p className="text-base font-medium text-foreground">
          {searchQuery ? 'No projects match your search' : 'No projects yet'}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {searchQuery
            ? 'Try a different keyword or clear the search to see all projects.'
            : 'Start with a blank project or pick a template to move faster.'}
        </p>
        {!searchQuery && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={onCreateCanvas}
              className="rounded-lg bg-[#3b82f6] px-4 py-2 text-white transition-colors hover:bg-[#2563eb]"
            >
              Create Project
            </button>
            <button
              onClick={onBrowseTemplates}
              className="rounded-lg border border-border bg-background px-4 py-2 text-foreground transition-colors hover:bg-muted"
            >
              Browse Templates
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <StaggeredList className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {canvases.map((canvas) => (
        <StaggerItem key={canvas.id}>
          <CanvasCard
            canvas={canvas}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onRefreshPreview={onRefreshPreview}
          />
        </StaggerItem>
      ))}
    </StaggeredList>
  );
}
