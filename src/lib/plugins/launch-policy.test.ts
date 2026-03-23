import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluatePluginLaunchPolicy, resolveAllowedTrustTiers } from './launch-policy';
import type { AgentPlugin } from './types';

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createPlugin(overrides: Partial<AgentPlugin> = {}): AgentPlugin {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    description: 'Test plugin',
    icon: () => null,
    category: 'planning',
    author: {
      type: 'official',
      name: 'Koda',
      verified: true,
    },
    version: '1.0.0',
    visibility: 'public',
    policy: {
      capabilityDeclarations: ['canvas:read'],
      distributionVisibility: ['oss'],
      trustTier: 'community',
    },
    type: 'agent',
    sandbox: {
      component: () => null,
      size: 'small',
      title: 'Test',
    },
    capabilities: ['canvas:read'],
    services: ['ai'],
    ...overrides,
  };
}

test('resolveAllowedTrustTiers defaults to hosted-safe trust tiers', () => {
  const tiers = withEnv(
    {
      KODA_PLUGIN_TRUST_TIERS: undefined,
      NEXT_PUBLIC_KODA_PLUGIN_TRUST_TIERS: undefined,
    },
    () => resolveAllowedTrustTiers('hosted')
  );

  assert.deepEqual([...tiers].sort(), ['official', 'verified']);
});

test('evaluatePluginLaunchPolicy blocks distribution mismatch with explicit code', () => {
  const decision = withEnv(
    {
      KODA_DISTRIBUTION: 'hosted',
      KODA_PLUGIN_TRUST_TIERS: undefined,
      NEXT_PUBLIC_KODA_PLUGIN_TRUST_TIERS: undefined,
    },
    () => evaluatePluginLaunchPolicy(createPlugin())
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'PLUGIN_DISTRIBUTION_BLOCKED');
});

test('evaluatePluginLaunchPolicy blocks trust tier mismatch with explicit code', () => {
  const decision = withEnv(
    {
      KODA_DISTRIBUTION: 'oss',
      KODA_PLUGIN_TRUST_TIERS: 'official,verified',
    },
    () => evaluatePluginLaunchPolicy(createPlugin())
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'PLUGIN_TRUST_TIER_BLOCKED');
});

test('evaluatePluginLaunchPolicy allows matching distribution and trust tier', () => {
  const decision = withEnv(
    {
      KODA_DISTRIBUTION: 'oss',
      KODA_PLUGIN_TRUST_TIERS: 'official,community',
    },
    () => evaluatePluginLaunchPolicy(createPlugin())
  );

  assert.equal(decision.allowed, true);
  assert.equal(decision.code, 'PLUGIN_ALLOWED');
});
