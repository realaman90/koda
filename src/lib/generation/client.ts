import {
  DEFAULT_HEYGEN_AVATAR4_VOICE,
  MODEL_CAPABILITIES,
  VIDEO_MODEL_CAPABILITIES,
  normalizeVideoModelOptions,
  resolveDeprecatedVideoModel,
  type ConnectedNodeInputs,
  type ImageGeneratorNodeData,
  type ImageInput,
  type ImageModelType,
  type ImagePortRole,
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
  imageInputs?: Record<string, { role: ImagePortRole; urls: string[]; label: string }>;
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
  characterVideos?: Array<{ name: string; videoUrl: string }>;
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

/**
 * Process @mention references in the prompt for flat-array models.
 * Replaces @label with plain text and prepends image label declarations.
 */
export function processPromptTokens(
  prompt: string,
  imageInputs: Record<string, { role: ImagePortRole; urls: string[]; label: string }>,
  model: ImageModelType
): { processedPrompt: string; orderedUrls: string[] } {
  const capabilities = MODEL_CAPABILITIES[model];
  const supportedRoles = capabilities?.supportedRoles || ['reference'];
  const isStructured = supportedRoles.length > 1;

  // Find all @label references in prompt (@ followed by word chars, at word boundary or start)
  const tokenPattern = /(?:^|(?<=\s))@([a-zA-Z0-9_]+)/g;
  const usedLabels: string[] = [];
  let match;
  while ((match = tokenPattern.exec(prompt)) !== null) {
    const label = match[1];
    if (imageInputs[label]) {
      usedLabels.push(label);
    }
  }

  // If no tokens used or no imageInputs, return as-is
  if (usedLabels.length === 0 || Object.keys(imageInputs).length === 0) {
    const allUrls = Object.values(imageInputs).flatMap(input => input.urls);
    return { processedPrompt: prompt, orderedUrls: allUrls };
  }

  // For structured models, strip @tokens (routing is by role)
  if (isStructured) {
    const stripped = prompt.replace(tokenPattern, (full, label) =>
      imageInputs[label] ? label : full
    );
    const allUrls = Object.values(imageInputs).flatMap(input => input.urls);
    return { processedPrompt: stripped, orderedUrls: allUrls };
  }

  // For flat-array models, order URLs by mention order and build natural prompt
  const orderedUrls: string[] = [];
  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

  // First: referenced images in order of appearance
  for (const label of usedLabels) {
    const input = imageInputs[label];
    orderedUrls.push(...input.urls);
  }

  // Then: unreferenced images
  for (const [label, input] of Object.entries(imageInputs)) {
    if (!usedLabels.includes(label)) {
      orderedUrls.push(...input.urls);
    }
  }

  // Build mapping: replace @label with "the Nth image (label)" for model clarity
  const cleanedPrompt = prompt.replace(tokenPattern, (full, label) => {
    if (!imageInputs[label]) return full;
    const idx = usedLabels.indexOf(label);
    const ordinal = ordinals[idx] || `image ${idx + 1}`;
    return `the ${ordinal} reference image (${label})`;
  });

  return { processedPrompt: cleanedPrompt, orderedUrls };
}

export function buildImageGenerationRequest(
  data: ImageGeneratorNodeData,
  connectedInputs: ConnectedNodeInputs,
  overrides: Partial<Pick<ImageGenerationRequestBody, 'model' | 'imageCount'>> = {}
): ImageGenerationRequestBody {
  const allReferenceUrls = getAllReferenceUrls(connectedInputs);
  const model = overrides.model ?? data.model;

  // Build imageInputs from connectedInputs if available
  const imageInputs = connectedInputs.imageInputs
    ? Object.fromEntries(
        Object.entries(connectedInputs.imageInputs).map(([label, input]) => [
          label,
          { role: input.role, urls: input.urls, label: input.label },
        ])
      )
    : undefined;

  // Process prompt tokens if imageInputs exist
  let prompt = buildImagePrompt(data, connectedInputs);
  let orderedReferenceUrls = allReferenceUrls;
  if (imageInputs && Object.keys(imageInputs).length > 0) {
    const result = processPromptTokens(prompt, imageInputs, model);
    prompt = result.processedPrompt;
    orderedReferenceUrls = result.orderedUrls;
  }

  return {
    prompt,
    model,
    aspectRatio: data.aspectRatio,
    imageSize: data.imageSize || 'square_hd',
    resolution: data.resolution || '1K',
    imageCount: overrides.imageCount ?? data.imageCount ?? 1,
    referenceUrl: connectedInputs.referenceUrl,
    referenceUrls: orderedReferenceUrls.length > 0 ? orderedReferenceUrls : undefined,
    imageInputs,
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
    characterVideos: connectedInputs.characterVideos?.length
      ? connectedInputs.characterVideos
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
