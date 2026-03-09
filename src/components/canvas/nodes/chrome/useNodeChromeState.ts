'use client';

import { useMemo } from 'react';
import type { NodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';

export interface ResolveNodeChromeStateInput {
  isHovered: boolean;
  focusedWithin: boolean;
  isPromptFocused?: boolean;
  selected: boolean;
  displayMode: NodeDisplayMode;
  hasOutput: boolean;
  expanded?: boolean;
}

export interface NodeChromeState {
  isActive: boolean;
  showTopToolbar: boolean;
  showFooterRail: boolean;
  showPromptTeaser: boolean;
  showPromptEditor: boolean;
  showHandles: boolean;
  showTopBadges: boolean;
  showSecondaryContent: boolean;
}

export function resolveNodeChromeState({
  isHovered,
  focusedWithin,
  isPromptFocused = false,
  selected,
  displayMode,
  hasOutput,
  expanded = false,
}: ResolveNodeChromeStateInput): NodeChromeState {
  const isActive = selected || focusedWithin || isPromptFocused;
  const allowRichChrome = displayMode === 'full';
  const allowHoverChrome = displayMode !== 'summary';
  const showPromptEditor = allowRichChrome && (expanded || isPromptFocused);
  const showTopToolbar = allowHoverChrome && (isHovered || isActive);
  const showFooterRail = allowHoverChrome && (isHovered || isActive);
  const showHandles = isHovered || isActive;

  return {
    isActive,
    showTopToolbar,
    showFooterRail,
    showPromptTeaser: displayMode !== 'summary' && !showPromptEditor,
    showPromptEditor,
    showHandles,
    showTopBadges: hasOutput && (selected || focusedWithin || isHovered || displayMode !== 'summary'),
    showSecondaryContent: displayMode === 'full' || (!!hasOutput && displayMode === 'compact'),
  };
}

export function useNodeChromeState(input: ResolveNodeChromeStateInput): NodeChromeState {
  return useMemo(() => resolveNodeChromeState(input), [input]);
}
