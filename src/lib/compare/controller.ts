import { openBillingPrompt } from '@/stores/billing-prompt-store';
import type {
  ConnectedNodeInputs,
  ImageGeneratorNodeData,
  ImageModelType,
  VideoGeneratorNodeData,
  VideoModelType,
} from '../types';
import type { GenerationHistoryItem } from '@/stores/settings-store';
import { clampCompareModels } from './utils';
import {
  fetchImageCompareEstimate,
  fetchVideoCompareEstimate,
  runImageCompare,
  runVideoCompare,
} from './run';

type UpdateNodeData = (nodeId: string, data: Record<string, unknown>, skipHistory?: boolean) => void;

interface HistoryCallbacks {
  addToHistory: (item: Omit<GenerationHistoryItem, 'id' | 'timestamp'>) => string;
  updateHistoryItem: (id: string, patch: Partial<Omit<GenerationHistoryItem, 'id' | 'timestamp'>>) => void;
}

interface BaseCompareParams {
  nodeId: string;
  updateNodeData: UpdateNodeData;
  history: HistoryCallbacks;
  confirmImpl?: (message: string) => boolean;
  fetchImpl?: typeof fetch;
}

function buildCompareConfirmationMessage(totalCredits: number, balance: number | null): string {
  if (balance === null) {
    return `Run compare? This will use an estimated ${totalCredits} credits.`;
  }

  return `Run compare? This will use an estimated ${totalCredits} credits. Current balance: ${balance}.`;
}

function handleInsufficientEstimate(totalCredits: number, balance: number | null): string {
  openBillingPrompt({
    message: balance === null
      ? `This compare run is estimated to cost ${totalCredits} credits.`
      : `This compare run needs ${totalCredits} credits and you have ${balance}.`,
    required: totalCredits,
    balance,
  });

  return balance === null
    ? `This compare run is estimated to cost ${totalCredits} credits.`
    : `This compare run needs ${totalCredits} credits and you have ${balance}.`;
}

export async function startImageCompare(
  params: BaseCompareParams & {
    data: ImageGeneratorNodeData;
    connectedInputs: ConnectedNodeInputs;
  }
): Promise<{ cancelled?: boolean; status?: 'completed' | 'partial_failed' | 'failed' }> {
  const {
    nodeId,
    data,
    connectedInputs,
    updateNodeData,
    history,
    confirmImpl = (message) => window.confirm(message),
    fetchImpl = fetch,
  } = params;

  const models = clampCompareModels((data.compareModels || []).filter((model): model is ImageModelType => model !== 'auto'));
  if (models.length < 2) {
    throw new Error('Select at least 2 models to compare.');
  }

  updateNodeData(nodeId, { compareRunStatus: 'estimating', error: undefined }, true);
  const estimate = await fetchImageCompareEstimate(models, fetchImpl);

  updateNodeData(nodeId, {
    compareModels: models,
    compareEstimateCredits: estimate.totalCredits,
    compareRunStatus: 'confirming',
    error: undefined,
  }, true);

  if (estimate.hasSufficientCredits === false) {
    const message = handleInsufficientEstimate(estimate.totalCredits, estimate.balance);
    updateNodeData(nodeId, { compareRunStatus: 'idle', error: message }, true);
    throw new Error(message);
  }

  if (!confirmImpl(buildCompareConfirmationMessage(estimate.totalCredits, estimate.balance))) {
    updateNodeData(nodeId, { compareRunStatus: 'idle' }, true);
    return { cancelled: true };
  }

  const result = await runImageCompare({
    nodeId,
    data,
    connectedInputs,
    estimate,
    updateNodeData,
    history,
    fetchImpl,
  });

  return { status: result.status };
}

export async function startVideoCompare(
  params: BaseCompareParams & {
    data: VideoGeneratorNodeData;
    connectedInputs: ConnectedNodeInputs;
  }
): Promise<{ cancelled?: boolean; status?: 'completed' | 'partial_failed' | 'failed' }> {
  const {
    nodeId,
    data,
    connectedInputs,
    updateNodeData,
    history,
    confirmImpl = (message) => window.confirm(message),
    fetchImpl = fetch,
  } = params;

  const models = clampCompareModels((data.compareModels || []).filter((model): model is VideoModelType => model !== 'auto'));
  if (models.length < 2) {
    throw new Error('Select at least 2 models to compare.');
  }

  updateNodeData(nodeId, { compareRunStatus: 'estimating', error: undefined }, true);
  const estimate = await fetchVideoCompareEstimate(models, data.duration, data.generateAudio !== false, fetchImpl);

  updateNodeData(nodeId, {
    compareModels: models,
    compareEstimateCredits: estimate.totalCredits,
    compareRunStatus: 'confirming',
    error: undefined,
  }, true);

  if (estimate.hasSufficientCredits === false) {
    const message = handleInsufficientEstimate(estimate.totalCredits, estimate.balance);
    updateNodeData(nodeId, { compareRunStatus: 'idle', error: message }, true);
    throw new Error(message);
  }

  if (!confirmImpl(buildCompareConfirmationMessage(estimate.totalCredits, estimate.balance))) {
    updateNodeData(nodeId, { compareRunStatus: 'idle' }, true);
    return { cancelled: true };
  }

  const result = await runVideoCompare({
    nodeId,
    data,
    connectedInputs,
    estimate,
    updateNodeData,
    history,
    fetchImpl,
  });

  return { status: result.status };
}
