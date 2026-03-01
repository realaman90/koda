'use client';

import { Loader2 } from 'lucide-react';
import { RemixIcon } from '@/components/common/RemixIcon';

interface RemixBannerProps {
  templateName: string;
  onRemix: () => void;
  isRemixing: boolean;
}

export function RemixBanner({ templateName, onRemix, isRemixing }: RemixBannerProps) {
  return (
    <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-blue-500/35 bg-blue-500/8 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-blue-100">{templateName}</span>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-200">
          Preview
        </span>
      </div>
      <button
        onClick={onRemix}
        disabled={isRemixing}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {isRemixing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RemixIcon className="h-4 w-4" />
        )}
        {isRemixing ? 'Remixing...' : 'Remix'}
      </button>
    </div>
  );
}
