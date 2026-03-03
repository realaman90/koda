import test from 'node:test';
import assert from 'node:assert/strict';

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createLocalStorageMock(): LocalStorageMock {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

test('resetTransientNodeStateForDuplicate clears in-flight image generation state', async () => {
  (globalThis as { localStorage?: LocalStorageMock }).localStorage = createLocalStorageMock();

  const { createImageGeneratorNode, resetTransientNodeStateForDuplicate } = await import('./canvas-store');

  const source = createImageGeneratorNode({ x: 10, y: 20 });
  const loadingNode = {
    ...source,
    data: {
      ...source.data,
      prompt: 'hero product shot',
      isGenerating: true,
      error: 'Network timeout',
    },
  };

  const duplicated = resetTransientNodeStateForDuplicate(loadingNode);

  assert.equal(duplicated.type, 'imageGenerator');
  assert.equal(duplicated.data.isGenerating, false);
  assert.equal(duplicated.data.error, undefined);
  assert.equal(duplicated.data.prompt, 'hero product shot');
});

test('resetTransientNodeStateForDuplicate leaves non-image nodes untouched', async () => {
  (globalThis as { localStorage?: LocalStorageMock }).localStorage = createLocalStorageMock();

  const { createTextNode, resetTransientNodeStateForDuplicate } = await import('./canvas-store');

  const textNode = createTextNode({ x: 0, y: 0 });
  const duplicated = resetTransientNodeStateForDuplicate(textNode);

  assert.equal(duplicated, textNode);
});
