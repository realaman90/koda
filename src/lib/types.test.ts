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
