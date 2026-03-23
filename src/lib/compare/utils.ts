import {
  MAX_COMPARE_MODELS,
  type ImageCompareResult,
  type ImageGeneratorNodeData,
  type VideoCompareResult,
  type VideoGeneratorNodeData,
} from '../types';

export function clampCompareModels<T extends string>(models: T[]): T[] {
  return Array.from(new Set(models)).slice(0, MAX_COMPARE_MODELS);
}

export function buildInitialCompareSelection<T extends string>(
  currentModel: T,
  compatibleModels: T[]
): T[] {
  return compatibleModels.includes(currentModel) ? [currentModel] : [];
}

export function fillCompareSelection<T extends string>(compatibleModels: T[]): T[] {
  return clampCompareModels(compatibleModels);
}

export function pruneCompareSelection<T extends string>(
  selectedModels: T[] | undefined,
  compatibleModels: T[]
): { models: T[]; removed: T[] } {
  const selected = selectedModels || [];
  const next = selected.filter((model) => compatibleModels.includes(model));
  const removed = selected.filter((model) => !compatibleModels.includes(model));
  return {
    models: clampCompareModels(next),
    removed,
  };
}

export async function runQueuedTasks<T>(
  items: readonly T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<{ stop?: boolean } | void>
): Promise<void> {
  let cursor = 0;
  let stopped = false;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  async function worker(): Promise<void> {
    while (!stopped) {
      const index = cursor++;
      if (index >= items.length) return;

      const result = await handler(items[index], index);
      if (result?.stop) {
        stopped = true;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export function createCompareResultId(model: string): string {
  return `compare_${model}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function applyImageComparePromotion(
  result: ImageCompareResult
): Partial<ImageGeneratorNodeData> {
  return {
    model: result.model,
    outputUrl: result.outputUrl,
    outputUrls: result.outputUrls,
    promotedCompareResultId: result.id,
  };
}

export function applyVideoComparePromotion(
  result: VideoCompareResult
): Partial<VideoGeneratorNodeData> {
  return {
    model: result.model,
    outputUrl: result.outputUrl,
    thumbnailUrl: result.thumbnailUrl,
    outputVideoId: result.outputVideoId,
    promotedCompareResultId: result.id,
  };
}
