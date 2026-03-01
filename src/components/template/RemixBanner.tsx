'use client';

import { Loader2, Sparkles } from 'lucide-react';

interface RemixBannerProps {
  templateName: string;
  onRemix: () => void;
  isRemixing: boolean;
}

export function RemixBanner({ templateName, onRemix, isRemixing }: RemixBannerProps) {
  return (
    <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-blue-200">{templateName}</span>
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
          Preview
        </span>
      </div>
      <button
        onClick={onRemix}
        disabled={isRemixing}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {isRemixing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isRemixing ? 'Remixing...' : 'Remix'}
      </button>
    </div>
  );
}
