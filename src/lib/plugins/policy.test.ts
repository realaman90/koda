import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePluginPolicy } from './policy';
import type { AgentPlugin } from './types';

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
      capabilityDeclarations: ['canvas:read', 'canvas:create'],
      distributionVisibility: ['oss', 'hosted'],
      trustTier: 'official',
    },
    type: 'agent',
    sandbox: {
      component: () => null,
      size: 'small',
      title: 'Test',
    },
    capabilities: ['canvas:read', 'canvas:create'],
    services: ['ai'],
    ...overrides,
  };
}

test('validatePluginPolicy accepts plugin with complete policy schema', () => {
  const plugin = createPlugin();
  assert.equal(validatePluginPolicy(plugin), plugin);
});

test('validatePluginPolicy rejects when capability declarations are missing', () => {
  const plugin = createPlugin({
    policy: {
      capabilityDeclarations: ['canvas:read'],
      distributionVisibility: ['oss', 'hosted'],
      trustTier: 'official',
    },
  });

  assert.throws(() => validatePluginPolicy(plugin), /missing capability declarations/);
});

test('validatePluginPolicy rejects duplicate distribution visibility entries', () => {
  const plugin = createPlugin({
    policy: {
      capabilityDeclarations: ['canvas:read', 'canvas:create'],
      distributionVisibility: ['oss', 'oss'],
      trustTier: 'official',
    },
  });

  assert.throws(() => validatePluginPolicy(plugin), /distributionVisibility cannot contain duplicates/);
});
