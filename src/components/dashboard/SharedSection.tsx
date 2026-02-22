'use client';

import { ProjectsGrid } from './ProjectsGrid';
import type { CanvasMetadata } from '@/lib/storage';

interface SharedSectionProps {
  canvases: CanvasMetadata[];
  onCreateCanvas: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRefreshPreview?: (id: string) => void;
}

export function SharedSection({
  canvases,
  onCreateCanvas,
  onRename,
  onDuplicate,
  onDelete,
  onRefreshPreview,
}: SharedSectionProps) {
  return (
    <section>
      <h2 className="mb-2 font-serif text-2xl font-normal text-foreground">Shared</h2>
      <p className="mb-4 text-sm text-muted-foreground">Projects shared with you across workspaces.</p>
      <ProjectsGrid
        canvases={canvases}
        isLoading={false}
        loadError={null}
        searchQuery=""
        onCreateCanvas={onCreateCanvas}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onRefreshPreview={onRefreshPreview}
      />
    </section>
  );
}
