'use client';

import { useCallback, useMemo, useState, type FocusEventHandler } from 'react';
import { useCanvasStore } from '@/stores/canvas-store';
import type { CanvasDetailLevel } from '@/stores/canvas-store-helpers';

export type NodeDisplayMode = CanvasDetailLevel;

export function resolveCanvasDetailLevelFromZoom(zoom: number): CanvasDetailLevel {
  if (zoom >= 0.9) return 'full';
  if (zoom >= 0.55) return 'compact';
  return 'summary';
}

export function resolveNodeDisplayMode({
  selected,
  focusedWithin,
  detailLevel,
}: {
  selected: boolean;
  focusedWithin: boolean;
  detailLevel: CanvasDetailLevel;
}): NodeDisplayMode {
  if (selected || focusedWithin) {
    return 'full';
  }

  return detailLevel;
}

export function useNodeDisplayMode(selected: boolean): {
  displayMode: NodeDisplayMode;
  focusedWithin: boolean;
  focusProps: {
    onFocusCapture: FocusEventHandler<HTMLElement>;
    onBlurCapture: FocusEventHandler<HTMLElement>;
  };
} {
  const detailLevel = useCanvasStore((state) => state.canvasDetailLevel);
  const [focusedWithin, setFocusedWithin] = useState(false);

  const onFocusCapture = useCallback<FocusEventHandler<HTMLElement>>(() => {
    setFocusedWithin(true);
  }, []);

  const onBlurCapture = useCallback<FocusEventHandler<HTMLElement>>((event) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setFocusedWithin(false);
  }, []);

  const displayMode = useMemo(
    () => resolveNodeDisplayMode({ selected, focusedWithin, detailLevel }),
    [detailLevel, focusedWithin, selected]
  );

  return {
    displayMode,
    focusedWithin,
    focusProps: {
      onFocusCapture,
      onBlurCapture,
    },
  };
}
