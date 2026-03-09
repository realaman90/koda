import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCanvasPersistencePlan } from './canvas-persistence';
import { resolveCanvasDetailLevelFromZoom, resolveNodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';

test('typing mutations do not schedule persistence or previews', () => {
  const plan = resolveCanvasPersistencePlan({
    kind: 'typing',
    save: 'schedule',
    preview: 'schedule',
  });

  assert.deepEqual(plan, {
    localDelayMs: null,
    serverDelayMs: null,
    previewEligible: false,
  });
});

test('output mutations schedule fast local and server persistence', () => {
  const plan = resolveCanvasPersistencePlan({
    kind: 'output',
    save: 'schedule',
    preview: 'schedule',
  });

  assert.deepEqual(plan, {
    localDelayMs: 250,
    serverDelayMs: 1000,
    previewEligible: true,
  });
});

test('save skip disables persistence even for content mutations', () => {
  const plan = resolveCanvasPersistencePlan({
    kind: 'content',
    save: 'skip',
    preview: 'schedule',
  });

  assert.deepEqual(plan, {
    localDelayMs: null,
    serverDelayMs: null,
    previewEligible: true,
  });
});

test('detail level thresholds match the zoom buckets', () => {
  assert.equal(resolveCanvasDetailLevelFromZoom(1), 'full');
  assert.equal(resolveCanvasDetailLevelFromZoom(0.7), 'compact');
  assert.equal(resolveCanvasDetailLevelFromZoom(0.4), 'summary');
});

test('selected and focused nodes always render in full mode', () => {
  assert.equal(
    resolveNodeDisplayMode({ selected: true, focusedWithin: false, detailLevel: 'summary' }),
    'full'
  );
  assert.equal(
    resolveNodeDisplayMode({ selected: false, focusedWithin: true, detailLevel: 'compact' }),
    'full'
  );
  assert.equal(
    resolveNodeDisplayMode({ selected: false, focusedWithin: false, detailLevel: 'compact' }),
    'compact'
  );
});
