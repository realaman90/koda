import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateImageCompareModels,
  estimateVideoCompareModels,
  normalizeImageCompareModels,
  normalizeVideoCompareModels,
} from './estimate';

test('normalizeImageCompareModels dedupes and caps the compare set', () => {
  const models = normalizeImageCompareModels([
    'flux-pro',
    'flux-pro',
    'recraft-v4',
    'nanobanana-2',
    'grok-imagine-image',
    'ideogram-v3',
  ]);

  assert.deepEqual(models, ['flux-pro', 'recraft-v4', 'nanobanana-2', 'grok-imagine-image']);
});

test('normalizeVideoCompareModels rejects auto', () => {
  assert.throws(
    () => normalizeVideoCompareModels(['auto', 'veo-3.1-i2v']),
    /Unsupported video compare model: auto/
  );
});

test('estimateImageCompareModels sums per-model credits', () => {
  const estimate = estimateImageCompareModels(['grok-imagine-image', 'recraft-v4']);

  assert.deepEqual(estimate.items, [
    { model: 'grok-imagine-image', estimatedCredits: 1 },
    { model: 'recraft-v4', estimatedCredits: 2 },
  ]);
  assert.equal(estimate.totalCredits, 3);
});

test('estimateVideoCompareModels respects duration and audio pricing', () => {
  const estimate = estimateVideoCompareModels(['veo-3.1-fast-i2v', 'kling-3.0-t2v'], 10, true);

  assert.deepEqual(estimate.items, [
    { model: 'veo-3.1-fast-i2v', estimatedCredits: 46 },
    { model: 'kling-3.0-t2v', estimatedCredits: 76 },
  ]);
  assert.equal(estimate.totalCredits, 122);
});
