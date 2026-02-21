import test from 'node:test';
import assert from 'node:assert/strict';

import { PreviewLifecycleQueue } from './preview-lifecycle';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('debounces rapid preview requests for the same canvas', async (t) => {
  const runs: string[] = [];

  const queue = new PreviewLifecycleQueue({
    debounceMs: 30,
    run: async (id) => {
      runs.push(id);
    },
  });

  t.after(() => queue.dispose());

  queue.request('canvas-1', 'sig-1');
  await sleep(10);
  queue.request('canvas-1', 'sig-2');
  await sleep(10);
  queue.request('canvas-1', 'sig-3');

  await sleep(70);

  assert.equal(runs.length, 1);
  assert.equal(runs[0], 'canvas-1');
});

test('last write wins when changes arrive during an in-flight upload', async (t) => {
  const runs: number[] = [];
  let release: () => void = () => {};

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const queue = new PreviewLifecycleQueue({
    debounceMs: 30,
    run: async () => {
      runs.push(Date.now());
      await gate;
    },
  });

  t.after(() => queue.dispose());

  queue.request('canvas-1', 'sig-1');
  await sleep(40); // first job starts

  queue.request('canvas-1', 'sig-2');
  queue.request('canvas-1', 'sig-3');

  await sleep(50); // pending timer fires while first run is still in-flight
  assert.equal(runs.length, 1);

  release();

  await sleep(50); // second debounced run should execute
  assert.equal(runs.length, 2);
});
