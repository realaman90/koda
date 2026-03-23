import { getCreditCost } from '../credits/costs';
import {
  MAX_COMPARE_MODELS,
  MODEL_CAPABILITIES,
  VIDEO_MODEL_CAPABILITIES,
  type ImageModelType,
  type VideoModelType,
} from '../types';

export interface CompareEstimateItem<T extends string> {
  model: T;
  estimatedCredits: number;
}

export interface CompareEstimate<T extends string> {
  items: Array<CompareEstimateItem<T>>;
  totalCredits: number;
}

function dedupeAndClamp(rawModels: string[]): string[] {
  return Array.from(new Set(rawModels.map((model) => model.trim()).filter(Boolean))).slice(0, MAX_COMPARE_MODELS);
}

export function normalizeImageCompareModels(rawModels: string[]): ImageModelType[] {
  const models = dedupeAndClamp(rawModels);
  if (models.length === 0) {
    throw new Error('At least one image model is required');
  }

  const normalized = models.map((model) => {
    if (model === 'auto' || !(model in MODEL_CAPABILITIES)) {
      throw new Error(`Unsupported image compare model: ${model}`);
    }
    return model as ImageModelType;
  });

  return normalized;
}

export function normalizeVideoCompareModels(rawModels: string[]): VideoModelType[] {
  const models = dedupeAndClamp(rawModels);
  if (models.length === 0) {
    throw new Error('At least one video model is required');
  }

  const normalized = models.map((model) => {
    if (model === 'auto' || !(model in VIDEO_MODEL_CAPABILITIES)) {
      throw new Error(`Unsupported video compare model: ${model}`);
    }
    return model as VideoModelType;
  });

  return normalized;
}

export function estimateImageCompareModels(models: ImageModelType[]): CompareEstimate<ImageModelType> {
  const items = models.map((model) => ({
    model,
    estimatedCredits: getCreditCost('image', { model }),
  }));

  return {
    items,
    totalCredits: items.reduce((sum, item) => sum + item.estimatedCredits, 0),
  };
}

export function estimateVideoCompareModels(
  models: VideoModelType[],
  duration: number,
  generateAudio: boolean
): CompareEstimate<VideoModelType> {
  const items = models.map((model) => ({
    model,
    estimatedCredits: getCreditCost('video', { model, duration, generateAudio }),
  }));

  return {
    items,
    totalCredits: items.reduce((sum, item) => sum + item.estimatedCredits, 0),
  };
}
