'use client';

/**
 * StoryboardDraftCard
 *
 * Renders a storyboard draft inside the chat timeline.
 * Shows mode indicator, summary, expandable scenes, and "Create Nodes" button.
 */

import { useState, useCallback } from 'react';
import { ChevronRight, Grid3X3, ArrowLeftRight, LayoutGrid } from 'lucide-react';
import type { StoryboardDraft, StoryboardSceneData, StoryboardMode } from '@/lib/types';

interface StoryboardDraftCardProps {
  draft: StoryboardDraft;
  draftIndex: number;
  mode: StoryboardMode;
  isLatest: boolean;
  onCreateNodes?: () => void;
  isReadOnly?: boolean;
}

export function StoryboardDraftCard({
  draft,
  draftIndex,
  mode,
  isLatest,
  onCreateNodes,
  isReadOnly,
}: StoryboardDraftCardProps) {
  const sceneCount = draft.scenes.length;
  const videoCount = mode === 'single-shot' ? sceneCount : sceneCount - 1;

  return (
    <div className="bg-[#14161A] border border-[#1E2028] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1E2028] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {mode === 'single-shot' ? (
            <LayoutGrid className="w-3 h-3" />
          ) : (
            <ArrowLeftRight className="w-3 h-3" />
          )}
          <span>
            {sceneCount} images, {videoCount} {mode === 'single-shot' ? 'videos' : 'transitions'}
          </span>
        </div>
        <span className="text-[10px] font-medium text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
          v{draftIndex + 1}
        </span>
      </div>

      {/* Summary */}
      <div className="px-3 py-2">
        <p className="text-xs text-foreground/90">{draft.summary}</p>
      </div>

      {/* Expandable Scenes */}
      <div className="px-3 pb-2 space-y-1">
        {draft.scenes.map((scene) => (
          <DraftScenePreview key={scene.number} scene={scene} />
        ))}
      </div>

      {/* Create Nodes button — only on latest draft */}
      {isLatest && !isReadOnly && onCreateNodes && (
        <div className="px-3 pb-3">
          <button
            onClick={onCreateNodes}
            className="w-full py-2 px-3 bg-primary hover:bg-[var(--accent-primary-hover)] text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 nodrag"
          >
            <Grid3X3 className="w-3 h-3" />
            Create Nodes
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact expandable scene row inside a draft card */
function DraftScenePreview({ scene }: { scene: StoryboardSceneData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#0D0F12] rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-[#12141A] nodrag"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-medium text-blue-400 bg-blue-500/20 px-1 py-0.5 rounded shrink-0">
            {scene.number}
          </span>
          <span className="text-[11px] font-medium text-foreground truncate">{scene.title}</span>
        </div>
        <ChevronRight
          className={`w-3 h-3 text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1 text-[11px]">
          <p className="text-muted-foreground">{scene.description}</p>
          <div className="flex gap-1 text-[10px] flex-wrap">
            <span className="bg-[#14161A] px-1.5 py-0.5 rounded text-foreground/80">{scene.camera}</span>
            <span className="bg-[#14161A] px-1.5 py-0.5 rounded text-foreground/80">{scene.mood}</span>
          </div>
          <div className="p-1.5 bg-[#14161A] rounded text-[10px] text-muted-foreground font-mono leading-relaxed">
            {scene.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
