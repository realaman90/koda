'use client';

import { Loader2 } from 'lucide-react';
import { CanvasCard } from './CanvasCard';
import { StaggeredList, StaggerItem } from '@/components/common/StaggeredList';
import type { CanvasMetadata } from '@/lib/storage';

interface ProjectsGridProps {
  canvases: CanvasMetadata[];
  isLoading: boolean;
  searchQuery: string;
  onCreateCanvas: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectsGrid({
  canvases,
  isLoading,
  searchQuery,
  onCreateCanvas,
  onRename,
  onDuplicate,
  onDelete,
}: ProjectsGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (canvases.length === 0) {
    return (
      <div className="text-center py-16 bg-card/50 rounded-xl border border-border">
        <div className="text-5xl mb-4">🎬</div>
        <p className="text-muted-foreground mb-4">
          {searchQuery ? 'No projects match your search' : 'No projects yet. Create your first one!'}
        </p>
        {!searchQuery && (
          <button
            onClick={onCreateCanvas}
            className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg transition-colors"
          >
            Create Project
          </button>
        )}
      </div>
    );
  }

  return (
    <StaggeredList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {canvases.map((canvas) => (
        <StaggerItem key={canvas.id}>
          <CanvasCard
            canvas={canvas}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </StaggerItem>
      ))}
    </StaggeredList>
  );
}
