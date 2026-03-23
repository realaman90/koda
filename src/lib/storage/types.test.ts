import test from 'node:test';
import assert from 'node:assert/strict';

import { canvasToMetadata, normalizeStoredCanvas, type StoredCanvas } from './types';

function makeCanvas(overrides: Partial<StoredCanvas> = {}): StoredCanvas {
  return {
    id: 'canvas_test',
    name: 'Test Canvas',
    nodes: [],
    edges: [],
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

test('canvasToMetadata defaults thumbnailStatus to empty when preview fields are absent', () => {
  const canvas = makeCanvas();
  const metadata = canvasToMetadata(canvas);

  assert.equal(metadata.thumbnailStatus, 'empty');
  assert.equal(metadata.thumbnailUrl, undefined);
  assert.equal(metadata.thumbnail, undefined);
});

test('normalizeStoredCanvas preserves backward compatibility with legacy thumbnail field', () => {
  const canvas = makeCanvas({
    thumbnail: 'https://cdn.example.com/legacy-preview.jpg',
  });

  const normalized = normalizeStoredCanvas(canvas);
  const metadata = canvasToMetadata(canvas);

  assert.equal(normalized.thumbnailUrl, canvas.thumbnail);
  assert.equal(normalized.thumbnailStatus, 'ready');
  assert.equal(metadata.thumbnail, canvas.thumbnail);
  assert.equal(metadata.thumbnailUrl, canvas.thumbnail);
  assert.equal(metadata.thumbnailStatus, 'ready');
});
