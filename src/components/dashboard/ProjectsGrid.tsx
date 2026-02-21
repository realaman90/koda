'use client';

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
}: ProjectsGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-border bg-card/50 py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Failed to load projects: {loadError}</p>
        <button
          onClick={onRetryLoad}
          className="rounded-lg bg-[#3b82f6] px-4 py-2 text-white transition-colors hover:bg-[#2563eb]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (canvases.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 py-16 text-center">
        <div className="mb-4 text-5xl">🎬</div>
        <p className="mb-4 text-muted-foreground">
          {searchQuery ? 'No projects match your search' : 'No projects yet. Create your first one!'}
        </p>
        {!searchQuery && (
          <button
            onClick={onCreateCanvas}
            className="rounded-lg bg-[#3b82f6] px-4 py-2 text-white transition-colors hover:bg-[#2563eb]"
          >
            Create Project
          </button>
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
