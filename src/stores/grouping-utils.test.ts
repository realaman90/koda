import test from 'node:test';
import assert from 'node:assert/strict';

import { remapChildNodeIds, resolveInheritedGroupDelta } from './grouping-utils';

test('remapChildNodeIds remaps known IDs and drops stale IDs', () => {
  const idMap = new Map<string, string>([
    ['node_a', 'node_a_copy'],
    ['node_b', 'node_b_copy'],
  ]);

  const remapped = remapChildNodeIds(['node_a', 'node_missing', 'node_b'], idMap);

  assert.deepEqual(remapped, ['node_a_copy', 'node_b_copy']);
});

test('resolveInheritedGroupDelta resolves direct moving owner', () => {
  const explicitOwner = new Map<string, string>([['node_child', 'group_1']]);
  const groupDeltaById = new Map<string, { x: number; y: number }>([
    ['group_1', { x: 30, y: -10 }],
  ]);

  const delta = resolveInheritedGroupDelta('node_child', explicitOwner, groupDeltaById);

  assert.deepEqual(delta, { x: 30, y: -10 });
});

test('resolveInheritedGroupDelta resolves nearest moving ancestor in nested ownership', () => {
  const explicitOwner = new Map<string, string>([
    ['group_child', 'group_parent'],
    ['leaf_node', 'group_child'],
  ]);
  const groupDeltaById = new Map<string, { x: number; y: number }>([
    ['group_parent', { x: 12, y: 8 }],
  ]);

  const delta = resolveInheritedGroupDelta('leaf_node', explicitOwner, groupDeltaById);

  assert.deepEqual(delta, { x: 12, y: 8 });
});

test('resolveInheritedGroupDelta returns null when no ancestor is moving', () => {
  const explicitOwner = new Map<string, string>([['leaf_node', 'group_child']]);
  const groupDeltaById = new Map<string, { x: number; y: number }>();

  const delta = resolveInheritedGroupDelta('leaf_node', explicitOwner, groupDeltaById);

  assert.equal(delta, null);
});
