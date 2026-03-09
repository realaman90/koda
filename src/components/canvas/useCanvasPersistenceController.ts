'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';

export function useCanvasPersistenceController(): void {
  const currentCanvasId = useAppStore((state) => state.currentCanvasId);
  const hasUnsavedChanges = useAppStore((state) => state.hasUnsavedChanges);
  const flushCanvasPersistence = useAppStore((state) => state.flushCanvasPersistence);

  useEffect(() => {
    if (!currentCanvasId) return;

    const flushIfNeeded = () => {
      if (!useAppStore.getState().hasUnsavedChanges) return;
      flushCanvasPersistence(true).catch((error) => {
        console.error('Failed to flush canvas persistence:', error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushIfNeeded();
      }
    };

    window.addEventListener('pagehide', flushIfNeeded);
    window.addEventListener('beforeunload', flushIfNeeded);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushIfNeeded);
      window.removeEventListener('beforeunload', flushIfNeeded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (hasUnsavedChanges) {
        flushCanvasPersistence(true).catch((error) => {
          console.error('Failed to flush canvas persistence on unmount:', error);
        });
      }
    };
  }, [currentCanvasId, flushCanvasPersistence, hasUnsavedChanges]);
}
