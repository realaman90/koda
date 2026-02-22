import test from 'node:test';
import assert from 'node:assert/strict';

import { isSQLiteEnabled } from './sync-service';

test('isSQLiteEnabled follows runtime probe mode instead of backend/env assumptions', async (t) => {
  const originalFetch = global.fetch;

  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        mode: 'local-only',
        backend: 'sqlite',
        reason: 'runtime_features_disabled',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )) as typeof fetch;

  const enabled = await isSQLiteEnabled();
  assert.equal(enabled, false);
});

