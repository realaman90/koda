import type { AppNode } from '@/lib/types';

export const DEFAULT_NODE_DRAG_HANDLE = '.node-drag-handle';

export type CanvasDetailLevel = 'full' | 'compact' | 'summary';
export type CanvasMutationKind = 'content' | 'typing' | 'runtime' | 'layout' | 'graph' | 'output' | 'dragging';
export type CanvasMutationHistory = 'push' | 'skip';
export type CanvasMutationSave = 'schedule' | 'skip';
export type CanvasMutationPreview = 'schedule' | 'skip';

export interface CanvasMutationOptions {
  history?: CanvasMutationHistory;
  save?: CanvasMutationSave;
  preview?: CanvasMutationPreview;
  kind?: CanvasMutationKind;
}

export interface ResolvedCanvasMutationOptions {
  history: CanvasMutationHistory;
  save: CanvasMutationSave;
  preview: CanvasMutationPreview;
  kind: CanvasMutationKind;
}

export interface CanvasMutationRecord extends ResolvedCanvasMutationOptions {
  id: number;
  timestamp: number;
}

let mutationIdCounter = 0;

const DEFAULT_MUTATION_OPTIONS: ResolvedCanvasMutationOptions = {
  history: 'push',
  save: 'schedule',
  preview: 'schedule',
  kind: 'content',
};

const LEGACY_SKIP_OPTIONS: ResolvedCanvasMutationOptions = {
  history: 'skip',
  save: 'skip',
  preview: 'skip',
  kind: 'runtime',
};

export function resolveCanvasMutationOptions(
  options?: CanvasMutationOptions | boolean
): ResolvedCanvasMutationOptions {
  if (options === true) {
    return LEGACY_SKIP_OPTIONS;
  }

  if (!options) {
    return DEFAULT_MUTATION_OPTIONS;
  }

  return {
    history: options.history ?? DEFAULT_MUTATION_OPTIONS.history,
    save: options.save ?? DEFAULT_MUTATION_OPTIONS.save,
    preview: options.preview ?? DEFAULT_MUTATION_OPTIONS.preview,
    kind: options.kind ?? DEFAULT_MUTATION_OPTIONS.kind,
  };
}

export function createCanvasMutationRecord(
  options?: CanvasMutationOptions | boolean
): CanvasMutationRecord {
  return {
    ...resolveCanvasMutationOptions(options),
    id: ++mutationIdCounter,
    timestamp: Date.now(),
  };
}

export function normalizeAppNode<T extends AppNode>(node: T): T {
  if (node.dragHandle === DEFAULT_NODE_DRAG_HANDLE) {
    return node;
  }

  return {
    ...node,
    dragHandle: DEFAULT_NODE_DRAG_HANDLE,
  } as T;
}

export function normalizeAppNodes(nodes: AppNode[]): AppNode[] {
  let didMutate = false;
  const normalized = nodes.map((node) => {
    const nextNode = normalizeAppNode(node);
    if (nextNode !== node) {
      didMutate = true;
    }
    return nextNode;
  });

  return didMutate ? normalized : nodes;
}

export function deepCloneCanvasValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
