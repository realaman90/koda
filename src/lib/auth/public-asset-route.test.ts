import test from 'node:test';
import assert from 'node:assert/strict';

import { isPublicAssetReadRequest } from './public-asset-route';

test('allows anonymous GET and HEAD requests for proxied cloud asset reads', () => {
  assert.equal(isPublicAssetReadRequest('/api/assets/key/img_123/foo.jpg', 'GET'), true);
  assert.equal(isPublicAssetReadRequest('/api/assets/key/img_123/foo.jpg', 'HEAD'), true);
});

test('allows anonymous GET for local asset reads', () => {
  assert.equal(isPublicAssetReadRequest('/api/assets/img_abcd1234', 'GET'), true);
});

test('does not expose asset mutation routes', () => {
  assert.equal(isPublicAssetReadRequest('/api/assets/upload', 'GET'), false);
  assert.equal(isPublicAssetReadRequest('/api/assets/presign', 'GET'), false);
  assert.equal(isPublicAssetReadRequest('/api/assets/key/img_123/foo.jpg', 'POST'), false);
});

test('does not match incomplete or unrelated asset paths', () => {
  assert.equal(isPublicAssetReadRequest('/api/assets/key', 'GET'), false);
  assert.equal(isPublicAssetReadRequest('/api/assets', 'GET'), false);
  assert.equal(isPublicAssetReadRequest('/api/config', 'GET'), false);
});
