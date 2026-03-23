import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeVideoModelOptions,
  resolveVideoModel,
} from './types';

test('resolveVideoModel routes auto video requests to Kling 3.0 by input context', () => {
  assert.equal(resolveVideoModel('auto'), 'kling-3.0-t2v');
  assert.equal(
    resolveVideoModel('auto', { referenceUrl: 'https://cdn.example.com/reference.png' }),
    'kling-3.0-i2v'
  );
});

test('resolveVideoModel remaps deprecated Seedance 2.0 ids to supported fallbacks', () => {
  assert.equal(resolveVideoModel('seedance-2.0-fast-t2v'), 'kling-3.0-t2v');
  assert.equal(resolveVideoModel('seedance-2.0-fast-i2v'), 'kling-3.0-i2v');
  assert.equal(resolveVideoModel('seedance-2.0-t2v'), 'kling-3.0-pro-t2v');
  assert.equal(resolveVideoModel('seedance-2.0-i2v'), 'kling-3.0-pro-i2v');
});

test('normalizeVideoModelOptions snaps unsupported values to a valid Kling configuration', () => {
  const normalized = normalizeVideoModelOptions('kling-3.0-t2v', {
    aspectRatio: '4:3',
    duration: 8,
  });

  assert.deepEqual(normalized, {
    aspectRatio: '16:9',
    duration: 10,
  });
});

test('normalizeVideoModelOptions constrains LTX 2.3 Fast and Grok to the priced tiers', () => {
  const ltx = normalizeVideoModelOptions('ltx-2.3-fast-t2v', {
    aspectRatio: '1:1',
    duration: 15,
    resolution: '720p',
  });

  assert.deepEqual(ltx, {
    aspectRatio: '16:9',
    duration: 12,
    resolution: '1080p',
  });

  const grok = normalizeVideoModelOptions('grok-imagine-t2v', {
    aspectRatio: '1:1',
    duration: 6,
    resolution: '480p',
  });

  assert.deepEqual(grok, {
    aspectRatio: '1:1',
    duration: 6,
    resolution: '720p',
  });
});
