import {
  DEFAULT_HEYGEN_AVATAR4_VOICE,
  MODEL_CAPABILITIES,
  VIDEO_MODEL_CAPABILITIES,
  normalizeVideoModelOptions,
  resolveDeprecatedVideoModel,
  type ConnectedNodeInputs,
  type ImageGeneratorNodeData,
  type ImageModelType,
  type VideoGeneratorNodeData,
  type VideoModelType,
} from '../types';

export interface ImageGenerationRequestBody {
  prompt: string;
  model: ImageModelType;
  aspectRatio: ImageGeneratorNodeData['aspectRatio'];
  imageSize: ImageGeneratorNodeData['imageSize'];
  resolution: ImageGeneratorNodeData['resolution'];
  imageCount: number;
  referenceUrl?: string;
  referenceUrls?: string[];
  style?: ImageGeneratorNodeData['style'];
  magicPrompt?: ImageGeneratorNodeData['magicPrompt'];
  cfgScale?: ImageGeneratorNodeData['cfgScale'];
  steps?: ImageGeneratorNodeData['steps'];
  strength?: ImageGeneratorNodeData['strength'];
}

export interface VideoGenerationRequestBody {
  prompt: string;
  model: VideoModelType;
  aspectRatio: VideoGeneratorNodeData['aspectRatio'];
  duration: VideoGeneratorNodeData['duration'];
  resolution?: VideoGeneratorNodeData['resolution'];
  referenceUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
  videoUrl?: string;
  videoId?: string;
  audioUrl?: string;
  generateAudio?: boolean;
  heygenVoice?: VideoGeneratorNodeData['heygenVoice'];
}

interface ImagePromptSourceData {
  prompt?: string;
  selectedCharacter?: ImageGeneratorNodeData['selectedCharacter'];
  selectedStyle?: ImageGeneratorNodeData['selectedStyle'];
  selectedCameraAngle?: ImageGeneratorNodeData['selectedCameraAngle'];
  selectedCameraLens?: ImageGeneratorNodeData['selectedCameraLens'];
}

function appendIfValue(target: string[], value: string | undefined): void {
  if (value?.trim()) {
    target.push(value.trim());
  }
}

export function getAllReferenceUrls(connectedInputs: ConnectedNodeInputs): string[] {
  return Array.from(
    new Set(
      [connectedInputs.referenceUrl, ...(connectedInputs.referenceUrls || [])]
        .filter((url): url is string => !!url)
    )
  );
}

export function hasImageReferenceInput(connectedInputs: ConnectedNodeInputs): boolean {
  return getAllReferenceUrls(connectedInputs).length > 0;
}

export function buildImagePrompt(
  data: ImagePromptSourceData,
  connectedInputs: ConnectedNodeInputs
): string {
  const promptParts: string[] = [];

  if (data.selectedCharacter?.type === 'preset') {
    appendIfValue(promptParts, data.selectedCharacter.promptModifier);
  }
  if (data.selectedStyle) {
    appendIfValue(promptParts, data.selectedStyle.promptModifier);
  }
  if (data.selectedCameraAngle) {
    appendIfValue(promptParts, data.selectedCameraAngle.promptModifier);
  }
  if (data.selectedCameraLens) {
    appendIfValue(promptParts, data.selectedCameraLens.promptModifier);
  }

  appendIfValue(promptParts, connectedInputs.textContent);
  appendIfValue(promptParts, data.prompt);

  return promptParts.join(', ');
}

export function hasValidImagePromptInput(
  data: ImagePromptSourceData,
  connectedInputs: ConnectedNodeInputs
): boolean {
  return buildImagePrompt(data, connectedInputs).length > 0;
}

export function buildImageGenerationRequest(
  data: ImageGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs,
  overrides: Partial<Pick<ImageGenerationRequestBody, 'model' | 'imageCount'>> = {}
): ImageGenerationRequestBody {
  const allReferenceUrls = getAllReferenceUrls(connectedInputs);

  return {
    prompt: buildImagePrompt(data, connectedInputs),
    model: overrides.model ?? data.model,
    aspectRatio: data.aspectRatio,
    imageSize: data.imageSize || 'square_hd',
    resolution: data.resolution || '1K',
    imageCount: overrides.imageCount ?? data.imageCount ?? 1,
    referenceUrl: connectedInputs.referenceUrl,
    referenceUrls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
    style: data.style,
    magicPrompt: data.magicPrompt,
    cfgScale: data.cfgScale,
    steps: data.steps,
    strength: data.strength,
  };
}

export function getCompatibleImageCompareModels(
  enabledModels: ImageModelType[],
  data: ImageGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs
): ImageModelType[] {
  const hasPrompt = hasValidImagePromptInput(data, connectedInputs);
  const hasReferences = hasImageReferenceInput(connectedInputs);

  if (!hasPrompt) {
    return [];
  }

  return enabledModels.filter((model) => {
    if (model === 'auto') return false;
    const capabilities = MODEL_CAPABILITIES[model];
    if (!capabilities) return false;
    if (!capabilities.aspectRatios.includes(data.aspectRatio)) {
      return false;
    }
    if (capabilities.requiresReferenceForGeneration && !hasReferences) {
      return false;
    }
    return true;
  });
}

export function buildVideoPrompt(
  data: Pick<VideoGeneratorNodeData, 'prompt'>,
  connectedInputs: ConnectedNodeInputs
): string {
  const parts: string[] = [];
  appendIfValue(parts, connectedInputs.textContent);
  appendIfValue(parts, data.prompt);
  return parts.join('\n');
}

export function getVideoInputState(connectedInputs: ConnectedNodeInputs): {
  hasImageInput: boolean;
  hasAnyMediaInput: boolean;
} {
  const hasImageInput = !!(
    connectedInputs.referenceUrl ||
    connectedInputs.firstFrameUrl ||
    connectedInputs.lastFrameUrl ||
    connectedInputs.referenceUrls?.length
  );

  return {
    hasImageInput,
    hasAnyMediaInput: !!(
      hasImageInput ||
      connectedInputs.videoUrl ||
      connectedInputs.audioUrl
    ),
  };
}

export function validateVideoGenerationInputForModel(
  data: VideoGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs,
  model: VideoModelType
): string | null {
  const resolvedModel = resolveDeprecatedVideoModel(model);
  const capabilities = VIDEO_MODEL_CAPABILITIES[resolvedModel];
  const prompt = buildVideoPrompt(data, connectedInputs);
  const hasPrompt = prompt.trim().length > 0;
  const { hasImageInput, hasAnyMediaInput } = getVideoInputState(connectedInputs);

  if (!capabilities) {
    return 'Unsupported model';
  }

  switch (capabilities.inputMode) {
    case 'first-last-frame':
      if (!connectedInputs.firstFrameUrl) {
        return 'Missing first frame';
      }
      if (!capabilities.lastFrameOptional && !connectedInputs.lastFrameUrl) {
        return 'Missing last frame';
      }
      break;
    case 'multi-reference':
      if (!connectedInputs.referenceUrls?.length && !connectedInputs.referenceUrl) {
        return 'Missing reference images';
      }
      break;
    case 'single-image':
      if (capabilities.requiresImageRef && !hasImageInput) {
        return 'Missing image reference';
      }
      break;
    default:
      break;
  }

  if (capabilities.requiresPrompt && !hasPrompt) {
    return 'Missing prompt';
  }
  if (capabilities.requiresImageRef && !hasImageInput) {
    return 'Missing image reference';
  }
  if (capabilities.requiresVideoRef && !connectedInputs.videoUrl) {
    return 'Missing video reference';
  }
  if (capabilities.requiresAudioRef && !connectedInputs.audioUrl) {
    return 'Missing audio reference';
  }
  if (capabilities.requiresVideoId && !connectedInputs.videoId) {
    return 'Missing reusable video id';
  }
  if (!hasPrompt && !hasAnyMediaInput) {
    return 'Missing prompt or media reference';
  }

  return null;
}

export function hasValidVideoGenerationInputForModel(
  data: VideoGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs,
  model: VideoModelType
): boolean {
  return validateVideoGenerationInputForModel(data, connectedInputs, model) === null;
}

export function buildVideoGenerationRequest(
  data: VideoGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs,
  modelOverride?: VideoModelType
): VideoGenerationRequestBody {
  const resolvedModel = resolveDeprecatedVideoModel(modelOverride ?? data.model);
  const normalizedOptions = normalizeVideoModelOptions(resolvedModel, {
    aspectRatio: data.aspectRatio,
    duration: data.duration,
    resolution: data.resolution,
  });

  return {
    prompt: buildVideoPrompt(data, connectedInputs),
    model: resolvedModel,
    aspectRatio: normalizedOptions.aspectRatio,
    duration: normalizedOptions.duration,
    resolution: normalizedOptions.resolution,
    referenceUrl: connectedInputs.referenceUrl,
    firstFrameUrl: connectedInputs.firstFrameUrl,
    lastFrameUrl: connectedInputs.lastFrameUrl,
    referenceUrls: connectedInputs.referenceUrls,
    videoUrl: connectedInputs.videoUrl,
    videoId: connectedInputs.videoId,
    audioUrl: connectedInputs.audioUrl,
    generateAudio: data.generateAudio,
    heygenVoice: resolvedModel === 'heygen-avatar4-i2v'
      ? (data.heygenVoice || DEFAULT_HEYGEN_AVATAR4_VOICE)
      : undefined,
  };
}

export function getCompatibleVideoCompareModels(
  enabledModels: VideoModelType[],
  data: VideoGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs
): VideoModelType[] {
  const compatible: VideoModelType[] = [];
  const seen = new Set<VideoModelType>();

  for (const rawModel of enabledModels) {
    if (rawModel === 'auto') continue;
    const model = resolveDeprecatedVideoModel(rawModel);
    if (seen.has(model)) continue;
    seen.add(model);

    const capabilities = VIDEO_MODEL_CAPABILITIES[model];
    if (!capabilities.durations.includes(data.duration)) {
      continue;
    }
    if (!capabilities.aspectRatios.includes(data.aspectRatio)) {
      continue;
    }
    if (capabilities.resolutions && data.resolution && !capabilities.resolutions.includes(data.resolution)) {
      continue;
    }

    if (hasValidVideoGenerationInputForModel(data, connectedInputs, model)) {
      compatible.push(model);
    }
  }

  return compatible;
}
