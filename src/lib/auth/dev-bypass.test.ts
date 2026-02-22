import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEV_AUTH_BYPASS_HEADER,
  isApiDevBypassRequestAllowed,
  isDevAuthBypassEnabled,
} from './dev-bypass';

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};

  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];

    const next = overrides[key];
    if (typeof next === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = next;
    }
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      const next = previous[key];
      if (typeof next === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = next;
      }
    }
  }
}

test('isDevAuthBypassEnabled requires NODE_ENV=development and truthy DEV_AUTH_BYPASS', () => {
  withEnv({ NODE_ENV: 'development', DEV_AUTH_BYPASS: 'true' }, () => {
    assert.equal(isDevAuthBypassEnabled(), true);
  });

  withEnv({ NODE_ENV: 'production', DEV_AUTH_BYPASS: 'true' }, () => {
    assert.equal(isDevAuthBypassEnabled(), false);
  });

  withEnv({ NODE_ENV: 'development', DEV_AUTH_BYPASS: 'false' }, () => {
    assert.equal(isDevAuthBypassEnabled(), false);
  });
});

test('API bypass in development works without token when DEV_AUTH_BYPASS_TOKEN is not configured', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      DEV_AUTH_BYPASS: 'true',
      DEV_AUTH_BYPASS_TOKEN: undefined,
    },
    () => {
      assert.equal(isApiDevBypassRequestAllowed(new Headers()), true);
    }
  );
});

test('API bypass enforces x-dev-auth-bypass-token when DEV_AUTH_BYPASS_TOKEN is set', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      DEV_AUTH_BYPASS: 'true',
      DEV_AUTH_BYPASS_TOKEN: 'super-secret',
    },
    () => {
      assert.equal(isApiDevBypassRequestAllowed(new Headers()), false);
      assert.equal(
        isApiDevBypassRequestAllowed(new Headers([[DEV_AUTH_BYPASS_HEADER, 'wrong']])),
        false
      );
      assert.equal(
        isApiDevBypassRequestAllowed(new Headers([[DEV_AUTH_BYPASS_HEADER, 'super-secret']])),
        true
      );
    }
  );
});
