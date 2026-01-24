'use client';

import { Maximize2, Minimize2 } from 'lucide-react';

interface ExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  visible: boolean;
}

export function ExpandButton({ isExpanded, onToggle, visible }: ExpandButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`
        w-6 h-6 rounded-full bg-zinc-800 border border-zinc-600
        flex items-center justify-center
        hover:bg-zinc-700 hover:border-zinc-500
        transition-all duration-200
        ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}
      `}
      title={isExpanded ? 'Minimize' : 'Expand'}
    >
      {isExpanded ? (
        <Minimize2 className="w-3.5 h-3.5 text-zinc-300" />
      ) : (
        <Maximize2 className="w-3.5 h-3.5 text-zinc-300" />
      )}
    </button>
  );
}
