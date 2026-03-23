import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveCanvasPreviewState } from './canvas-preview-state';

const baseCanvas = {
  id: 'canvas_1',
  name: 'Canvas',
  createdAt: 1,
  updatedAt: 10,
  nodeCount: 0,
  thumbnailStatus: 'empty' as const,
};

test('returns empty when no preview exists', () => {
  const state = deriveCanvasPreviewState({ ...baseCanvas }, true);
  assert.equal(state, 'empty');
});

test('returns ready when preview URL exists', () => {
  const state = deriveCanvasPreviewState(
    { ...baseCanvas, thumbnailStatus: 'ready' as const, thumbnailUrl: 'https://cdn.example.com/a.jpg' },
    true,
  );
  assert.equal(state, 'ready');
});

test('returns stale when canvas changed after preview was generated', () => {
  const state = deriveCanvasPreviewState(
    {
      ...baseCanvas,
      thumbnailStatus: 'ready' as const,
      thumbnailUrl: 'https://cdn.example.com/a.jpg',
      thumbnailUpdatedAt: 5,
      updatedAt: 20,
    },
    true,
  );
  assert.equal(state, 'stale');
});

test('returns processing and error states explicitly', () => {
  const processing = deriveCanvasPreviewState({ ...baseCanvas, thumbnailStatus: 'processing' as const }, true);
  const error = deriveCanvasPreviewState({ ...baseCanvas, thumbnailStatus: 'error' as const }, true);

  assert.equal(processing, 'processing');
  assert.equal(error, 'error');
});

test('falls back to legacy thumbnail readiness when feature flag is disabled', () => {
  const legacyReady = deriveCanvasPreviewState(
    { ...baseCanvas, thumbnailStatus: 'processing' as const, thumbnail: '/api/assets/legacy-thumb' },
    false,
  );

  const legacyEmpty = deriveCanvasPreviewState(
    { ...baseCanvas, thumbnailStatus: 'ready' as const, thumbnail: undefined, thumbnailUrl: undefined },
    false,
  );

  assert.equal(legacyReady, 'ready');
  assert.equal(legacyEmpty, 'empty');
});
