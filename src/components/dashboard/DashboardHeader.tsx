'use client';

import { Plus } from 'lucide-react';

interface DashboardHeaderProps {
  onCreateCanvas: () => void;
}

export function DashboardHeader({ onCreateCanvas }: DashboardHeaderProps) {
  return (
    <div className="mb-8">
      <p className="text-muted-foreground text-sm mb-3">Create a new project and start creating</p>
      <button
        onClick={onCreateCanvas}
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        New project
      </button>
    </div>
  );
}
