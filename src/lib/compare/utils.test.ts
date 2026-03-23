import test from 'node:test';
import assert from 'node:assert/strict';

import type { ImageCompareResult, VideoCompareResult } from '../types';
import {
  applyImageComparePromotion,
  applyVideoComparePromotion,
  pruneCompareSelection,
  runQueuedTasks,
} from './utils';

test('pruneCompareSelection removes incompatible models and preserves order', () => {
  const result = pruneCompareSelection(
    ['flux-pro', 'grok-imagine-image-edit', 'recraft-v4'],
    ['recraft-v4', 'flux-pro']
  );

  assert.deepEqual(result.models, ['flux-pro', 'recraft-v4']);
  assert.deepEqual(result.removed, ['grok-imagine-image-edit']);
});

test('applyImageComparePromotion updates the canonical image output fields', () => {
  const result = {
    id: 'compare-image-1',
    model: 'flux-pro',
    status: 'completed',
    estimatedCredits: 3,
    outputUrl: 'https://cdn.example.com/image-1.png',
    outputUrls: ['https://cdn.example.com/image-1.png'],
  } as ImageCompareResult;

  assert.deepEqual(applyImageComparePromotion(result), {
    model: 'flux-pro',
    outputUrl: 'https://cdn.example.com/image-1.png',
    outputUrls: ['https://cdn.example.com/image-1.png'],
    promotedCompareResultId: 'compare-image-1',
  });
});

test('applyVideoComparePromotion updates the canonical video output fields', () => {
  const result = {
    id: 'compare-video-1',
    model: 'veo-3.1-i2v',
    status: 'completed',
    estimatedCredits: 30,
    outputUrl: 'https://cdn.example.com/video-1.mp4',
    thumbnailUrl: 'https://cdn.example.com/video-1.jpg',
    outputVideoId: 'video_123',
  } as VideoCompareResult;

  assert.deepEqual(applyVideoComparePromotion(result), {
    model: 'veo-3.1-i2v',
    outputUrl: 'https://cdn.example.com/video-1.mp4',
    thumbnailUrl: 'https://cdn.example.com/video-1.jpg',
    outputVideoId: 'video_123',
    promotedCompareResultId: 'compare-video-1',
  });
});

test('runQueuedTasks respects concurrency and stops scheduling after a stop signal', async () => {
  const active: number[] = [];
  const seen: number[] = [];
  let peakConcurrency = 0;

  await runQueuedTasks([0, 1, 2, 3, 4], 2, async (item) => {
    active.push(item);
    seen.push(item);
    peakConcurrency = Math.max(peakConcurrency, active.length);
    await new Promise((resolve) => setTimeout(resolve, item === 1 ? 5 : 1));
    active.splice(active.indexOf(item), 1);

    if (item === 2) {
      return { stop: true };
    }

    return undefined;
  });

  assert.equal(peakConcurrency, 2);
  assert.deepEqual(seen, [0, 1, 2]);
});
