import type { CanvasMetadata } from '@/lib/storage';

export type CanvasPreviewState = 'ready' | 'empty' | 'stale' | 'processing' | 'error';

export function deriveCanvasPreviewState(canvas: CanvasMetadata, previewSystemEnabled: boolean): CanvasPreviewState {
  if (!previewSystemEnabled) {
    return (canvas.thumbnailUrl || canvas.thumbnail) ? 'ready' : 'empty';
  }

  if (canvas.thumbnailStatus === 'processing') return 'processing';
  if (canvas.thumbnailStatus === 'error') return 'error';

  const hasPreview = !!(canvas.thumbnailUrl || canvas.thumbnail);
  const isStale = hasPreview
    && !!canvas.thumbnailUpdatedAt
    && canvas.updatedAt > canvas.thumbnailUpdatedAt;

  if (isStale || canvas.thumbnailStatus === 'stale') return 'stale';
  if (canvas.thumbnailStatus === 'ready' || hasPreview) return 'ready';

  return 'empty';
}
