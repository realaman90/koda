import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_NODE_DRAG_HANDLE,
  createCanvasMutationRecord,
  normalizeAppNode,
  normalizeAppNodes,
  resolveCanvasMutationOptions,
} from './canvas-store-helpers';

test('resolveCanvasMutationOptions maps legacy boolean skip semantics', () => {
  const options = resolveCanvasMutationOptions(true);

  assert.deepEqual(options, {
    history: 'skip',
    save: 'skip',
    preview: 'skip',
    kind: 'runtime',
  });
});

test('resolveCanvasMutationOptions falls back to defaults when options are omitted', () => {
  const options = resolveCanvasMutationOptions();

  assert.deepEqual(options, {
    history: 'push',
    save: 'schedule',
    preview: 'schedule',
    kind: 'content',
  });
});

test('normalizeAppNode injects the shared drag handle selector', () => {
  const node = normalizeAppNode({
    id: 'node-1',
    type: 'text',
    position: { x: 10, y: 20 },
    data: { content: 'hello' },
  } as any);

  assert.equal(node.dragHandle, DEFAULT_NODE_DRAG_HANDLE);
});

test('normalizeAppNodes preserves existing references when all nodes are already normalized', () => {
  const nodes = [
    {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { content: 'one' },
      dragHandle: DEFAULT_NODE_DRAG_HANDLE,
    },
  ] as any;

  assert.equal(normalizeAppNodes(nodes), nodes);
});

test('createCanvasMutationRecord returns monotonic ids', () => {
  const first = createCanvasMutationRecord({ kind: 'graph' });
  const second = createCanvasMutationRecord({ kind: 'layout' });

  assert.ok(second.id > first.id);
  assert.equal(first.kind, 'graph');
  assert.equal(second.kind, 'layout');
});
