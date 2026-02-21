import test from 'node:test';
import assert from 'node:assert/strict';

import { withThumbnailVersion } from './preview-utils';

test('appends version token to a URL without query params', () => {
  const next = withThumbnailVersion('/api/assets/abc123', 'ver-1');
  assert.equal(next, '/api/assets/abc123?v=ver-1');
});

test('appends version token using query separator when params already exist', () => {
  const next = withThumbnailVersion('/api/assets/abc123?size=sm', 'ver-2');
  assert.equal(next, '/api/assets/abc123?size=sm&v=ver-2');
});

test('encodes version token to keep URLs valid', () => {
  const next = withThumbnailVersion('/api/assets/abc123', '2026/02/22 00:16');
  assert.equal(next, '/api/assets/abc123?v=2026%2F02%2F22%2000%3A16');
});

test('keeps URL unchanged when no version is provided', () => {
  const next = withThumbnailVersion('/api/assets/abc123');
  assert.equal(next, '/api/assets/abc123');
});
