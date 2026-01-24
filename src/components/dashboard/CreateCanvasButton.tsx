'use client';

import { Plus } from 'lucide-react';

interface CreateCanvasButtonProps {
  onClick: () => void;
}

export function CreateCanvasButton({ onClick }: CreateCanvasButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group bg-card border border-dashed border-border rounded-xl overflow-hidden hover:border-indigo-500/50 hover:bg-card/80 transition-all"
    >
      <div className="aspect-video flex flex-col items-center justify-center gap-2">
        <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-indigo-600 flex items-center justify-center transition-colors">
          <Plus className="h-6 w-6 text-muted-foreground group-hover:text-white transition-colors" />
        </div>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          New Canvas
        </span>
      </div>
    </button>
  );
}
