import { getApiErrorMessage, normalizeApiErrorMessage } from '../client/api-error';
import {
  type ImageCompareResult,
  type ImageGeneratorNodeData,
  type ImageModelType,
  type VideoCompareResult,
  type VideoGeneratorNodeData,
  type VideoModelType,
  type ConnectedNodeInputs,
} from '../types';
import type { GenerationHistoryItem } from '../../stores/settings-store';
import { buildImageGenerationRequest, buildImagePrompt, buildVideoGenerationRequest, buildVideoPrompt } from '../generation/client';
import type { CompareEstimateItem } from './estimate';
import { applyImageComparePromotion, applyVideoComparePromotion, createCompareResultId, runQueuedTasks } from './utils';

interface HistoryCallbacks {
  addToHistory: (item: Omit<GenerationHistoryItem, 'id' | 'timestamp'>) => string;
  updateHistoryItem: (id: string, patch: Partial<Omit<GenerationHistoryItem, 'id' | 'timestamp'>>) => void;
}

type UpdateNodeData = (nodeId: string, data: Record<string, unknown>, skipHistory?: boolean) => void;

export interface CompareEstimateResponse<T extends string> {
  items: Array<CompareEstimateItem<T>>;
  totalCredits: number;
  balance: number | null;
  hasSufficientCredits: boolean | null;
}

async function parseEstimateResponse<T extends string>(
  response: Response
): Promise<CompareEstimateResponse<T>> {
  if (!response.ok) {
    const message = await getApiErrorMessage(response, 'Compare estimate failed');
    throw new Error(message);
  }

  return response.json() as Promise<CompareEstimateResponse<T>>;
}

export async function fetchImageCompareEstimate(
  models: ImageModelType[],
  fetchImpl: typeof fetch = fetch
): Promise<CompareEstimateResponse<ImageModelType>> {
  const response = await fetchImpl('/api/generate/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ models }),
  });

  return parseEstimateResponse<ImageModelType>(response);
}

export async function fetchVideoCompareEstimate(
  models: VideoModelType[],
  duration: number,
  generateAudio: boolean,
  fetchImpl: typeof fetch = fetch
): Promise<CompareEstimateResponse<VideoModelType>> {
  const response = await fetchImpl('/api/generate-video/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ models, duration, generateAudio }),
  });

  return parseEstimateResponse<VideoModelType>(response);
}

function summarizeCompareStatus<T extends { status: 'queued' | 'running' | 'completed' | 'failed' }>(
  results: T[]
): 'completed' | 'partial_failed' | 'failed' {
  const completedCount = results.filter((result) => result.status === 'completed').length;
  if (completedCount === 0) return 'failed';
  if (completedCount === results.length) return 'completed';
  return 'partial_failed';
}

function buildCompareHistoryResults<T extends { model: string; status: 'queued' | 'running' | 'completed' | 'failed'; error?: string; outputUrl?: string; thumbnailUrl?: string }>(
  results: T[]
): GenerationHistoryItem['compareResults'] {
  return results.map((result) => ({
    model: result.model,
    status: result.status === 'completed' ? 'completed' : 'failed',
    urls: result.outputUrl ? [result.outputUrl] : undefined,
    thumbnailUrl: result.thumbnailUrl,
    error: result.error,
  }));
}

export async function runImageCompare(
  params: {
    nodeId: string;
    data: ImageGeneratorNodeData;
    connectedInputs: ConnectedNodeInputs;
    estimate: CompareEstimateResponse<ImageModelType>;
    updateNodeData: UpdateNodeData;
    history: HistoryCallbacks;
    fetchImpl?: typeof fetch;
  }
): Promise<{ status: 'completed' | 'partial_failed' | 'failed'; results: ImageCompareResult[] }> {
  const {
    nodeId,
    data,
    connectedInputs,
    estimate,
    updateNodeData,
    history,
    fetchImpl = fetch,
  } = params;

  const prompt = buildImagePrompt(data, connectedInputs);
  const results: ImageCompareResult[] = estimate.items.map((item) => ({
    id: createCompareResultId(item.model),
    model: item.model,
    status: 'queued',
    estimatedCredits: item.estimatedCredits,
  }));

  let stoppedForCredits = false;
  let insufficientMessage = 'You are out of credits. Please upgrade your plan to continue generating.';

  const setResults = (nextResults: ImageCompareResult[], status: ImageGeneratorNodeData['compareRunStatus']) => {
    updateNodeData(nodeId, {
      compareResults: nextResults,
      compareRunStatus: status,
    }, true);
  };

  updateNodeData(nodeId, {
    compareResults: results,
    compareRunStatus: 'running',
    compareEstimateCredits: estimate.totalCredits,
    promotedCompareResultId: undefined,
    compareHistoryId: undefined,
    error: undefined,
  }, true);

  await runQueuedTasks(results, 2, async (result, index) => {
    const startedAt = Date.now();
    results[index] = { ...result, status: 'running', startedAt, error: undefined };
    setResults([...results], 'running');

    try {
      const requestBody = buildImageGenerationRequest(data, connectedInputs, {
        model: result.model,
        imageCount: 1,
      });

      const response = await fetchImpl('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Generation failed');
        results[index] = {
          ...results[index],
          status: 'failed',
          error: message,
          completedAt: Date.now(),
        };
        setResults([...results], 'running');

        if (response.status === 402) {
          stoppedForCredits = true;
          insufficientMessage = message;
          return { stop: true };
        }
        return;
      }

      const payload = await response.json() as { imageUrls?: string[]; imageUrl?: string };
      const outputUrls = payload.imageUrls || (payload.imageUrl ? [payload.imageUrl] : []);
      results[index] = {
        ...results[index],
        status: 'completed',
        outputUrl: outputUrls[0],
        outputUrls,
        completedAt: Date.now(),
      };
      setResults([...results], 'running');
    } catch (error) {
      results[index] = {
        ...results[index],
        status: 'failed',
        error: normalizeApiErrorMessage(error, 'Generation failed'),
        completedAt: Date.now(),
      };
      setResults([...results], 'running');
    }
  });

  if (stoppedForCredits) {
    for (let index = 0; index < results.length; index += 1) {
      if (results[index].status === 'queued') {
        results[index] = {
          ...results[index],
          status: 'failed',
          error: insufficientMessage,
          completedAt: Date.now(),
        };
      }
    }
  }

  const finalStatus = summarizeCompareStatus(results);
  const historyId = history.addToHistory({
    type: 'image',
    mode: 'compare',
    prompt,
    model: `Compare (${estimate.items.length} models)`,
    models: estimate.items.map((item) => item.model),
    status: finalStatus === 'failed' ? 'failed' : 'completed',
    compareResults: buildCompareHistoryResults(results),
    settings: {
      aspectRatio: data.aspectRatio,
      imageCount: 1,
    },
  });

  updateNodeData(nodeId, {
    compareResults: results,
    compareRunStatus: finalStatus,
    compareHistoryId: historyId,
  }, true);

  return {
    status: finalStatus,
    results,
  };
}

export async function runVideoCompare(
  params: {
    nodeId: string;
    data: VideoGeneratorNodeData;
    connectedInputs: ConnectedNodeInputs;
    estimate: CompareEstimateResponse<VideoModelType>;
    updateNodeData: UpdateNodeData;
    history: HistoryCallbacks;
    fetchImpl?: typeof fetch;
  }
): Promise<{ status: 'completed' | 'partial_failed' | 'failed'; results: VideoCompareResult[] }> {
  const {
    nodeId,
    data,
    connectedInputs,
    estimate,
    updateNodeData,
    history,
    fetchImpl = fetch,
  } = params;

  const prompt = buildVideoPrompt(data, connectedInputs);
  const results: VideoCompareResult[] = estimate.items.map((item) => ({
    id: createCompareResultId(item.model),
    model: item.model,
    status: 'queued',
    estimatedCredits: item.estimatedCredits,
  }));

  let stoppedForCredits = false;
  let insufficientMessage = 'You are out of credits. Please upgrade your plan to continue generating.';

  const setResults = (nextResults: VideoCompareResult[], status: VideoGeneratorNodeData['compareRunStatus']) => {
    updateNodeData(nodeId, {
      compareResults: nextResults,
      compareRunStatus: status,
    }, true);
  };

  updateNodeData(nodeId, {
    compareResults: results,
    compareRunStatus: 'running',
    compareEstimateCredits: estimate.totalCredits,
    promotedCompareResultId: undefined,
    compareHistoryId: undefined,
    error: undefined,
  }, true);

  await runQueuedTasks(results, 2, async (result, index) => {
    results[index] = {
      ...result,
      status: 'running',
      startedAt: Date.now(),
      error: undefined,
    };
    setResults([...results], 'running');

    try {
      const requestBody = buildVideoGenerationRequest(data, connectedInputs, result.model);
      const response = await fetchImpl('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Video generation failed');
        results[index] = {
          ...results[index],
          status: 'failed',
          error: message,
          completedAt: Date.now(),
        };
        setResults([...results], 'running');

        if (response.status === 402) {
          stoppedForCredits = true;
          insufficientMessage = message;
          return { stop: true };
        }
        return;
      }

      const payload = await response.json() as {
        async?: boolean;
        taskId?: string;
        videoUrl?: string;
        videoId?: string;
        thumbnailUrl?: string;
      };

      if (payload.async) {
        results[index] = {
          ...results[index],
          status: 'failed',
          error: 'Async compare models are not supported in compare mode.',
          completedAt: Date.now(),
        };
        setResults([...results], 'running');
        return;
      }

      results[index] = {
        ...results[index],
        status: 'completed',
        outputUrl: payload.videoUrl,
        outputVideoId: payload.videoId,
        thumbnailUrl: payload.thumbnailUrl,
        completedAt: Date.now(),
      };
      setResults([...results], 'running');
    } catch (error) {
      results[index] = {
        ...results[index],
        status: 'failed',
        error: normalizeApiErrorMessage(error, 'Video generation failed'),
        completedAt: Date.now(),
      };
      setResults([...results], 'running');
    }
  });

  if (stoppedForCredits) {
    for (let index = 0; index < results.length; index += 1) {
      if (results[index].status === 'queued') {
        results[index] = {
          ...results[index],
          status: 'failed',
          error: insufficientMessage,
          completedAt: Date.now(),
        };
      }
    }
  }

  const finalStatus = summarizeCompareStatus(results);
  const historyId = history.addToHistory({
    type: 'video',
    mode: 'compare',
    prompt,
    model: `Compare (${estimate.items.length} models)`,
    models: estimate.items.map((item) => item.model),
    status: finalStatus === 'failed' ? 'failed' : 'completed',
    compareResults: buildCompareHistoryResults(results),
    settings: {
      aspectRatio: data.aspectRatio,
      duration: data.duration,
      resolution: data.resolution,
    },
  });

  updateNodeData(nodeId, {
    compareResults: results,
    compareRunStatus: finalStatus,
    compareHistoryId: historyId,
  }, true);

  return {
    status: finalStatus,
    results,
  };
}

export function promoteImageCompareResult(
  nodeId: string,
  result: ImageCompareResult,
  updateNodeData: UpdateNodeData,
  history?: { historyId?: string; updateHistoryItem?: HistoryCallbacks['updateHistoryItem'] }
): void {
  updateNodeData(nodeId, applyImageComparePromotion(result), true);

  if (history?.historyId && history.updateHistoryItem) {
    history.updateHistoryItem(history.historyId, {
      winnerModel: result.model,
      result: result.outputUrls?.length ? { urls: result.outputUrls } : undefined,
    });
  }
}

export function promoteVideoCompareResult(
  nodeId: string,
  result: VideoCompareResult,
  updateNodeData: UpdateNodeData,
  history?: { historyId?: string; updateHistoryItem?: HistoryCallbacks['updateHistoryItem'] }
): void {
  updateNodeData(nodeId, applyVideoComparePromotion(result), true);

  if (history?.historyId && history.updateHistoryItem) {
    history.updateHistoryItem(history.historyId, {
      winnerModel: result.model,
      result: result.outputUrl ? { urls: [result.outputUrl] } : undefined,
    });
  }
}
