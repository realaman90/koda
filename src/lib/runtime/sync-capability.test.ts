import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSyncCapabilityProbe, resolveSyncCapability } from './sync-capability';

test('resolveSyncCapability returns local-only when sqlite backend is configured but runtime features are disabled', () => {
  const probe = resolveSyncCapability({
    backend: 'sqlite',
    authV1Enabled: false,
    workspacesV1Enabled: true,
  });

  assert.equal(probe.mode, 'local-only');
  assert.equal(probe.reason, 'runtime_features_disabled');
});

test('resolveSyncCapability returns provisioning-blocked for actor provisioning failures', () => {
  const probe = resolveSyncCapability({
    backend: 'sqlite',
    authV1Enabled: true,
    workspacesV1Enabled: true,
    actorStatus: 503,
    actorError: 'User provisioning in progress',
  });

  assert.equal(probe.mode, 'provisioning-blocked');
  assert.equal(probe.message, 'User provisioning in progress');
});

test('parseSyncCapabilityProbe rejects invalid payloads', () => {
  assert.equal(parseSyncCapabilityProbe({}), null);
  assert.equal(parseSyncCapabilityProbe({ mode: 'db-sync-available', backend: 'bogus' }), null);
});
