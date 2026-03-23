import type { Node, Edge } from '@xyflow/react';

// Node Types
export type NodeType = 'imageGenerator' | 'videoGenerator' | 'text' | 'media' | 'stickyNote' | 'sticker' | 'group' | 'storyboard' | 'productShot' |  'musicGenerator' | 'speech' | 'videoAudio' | 'pluginNode';

// ============================================
// PRESET TYPES (for Settings Panel)
// ============================================

// Base preset option with preview
export interface PresetOption {
  id: string;
  label: string;
  preview: string; // Path to preview image
  promptModifier: string; // Text to append to prompt
}

// Character preset (can also be custom uploaded)
export interface CharacterPreset extends PresetOption {
  type: 'preset';
}

export interface CharacterCustom {
  id: string;
  type: 'custom';
  imageUrl: string; // User uploaded image
  label?: string;
}

export type CharacterSelection = CharacterPreset | CharacterCustom | null;

// Style preset
export interface StylePreset extends PresetOption {}

// Camera angle preset
export interface CameraAnglePreset extends PresetOption {}

// Camera lens preset
export interface CameraLensPreset extends PresetOption {}

// Camera preset (camera body types)
export interface CameraPreset extends PresetOption {}

// Reference type for style/character references
export interface ImageReference {
  id: string;
  url: string;
  type: 'style' | 'character' | 'upload';
}

// Image port roles for structured model routing
export type ImagePortRole = 'reference' | 'style' | 'ip_adapter' | 'controlnet' | 'base' | 'element' | 'face';

// Structured image input from a connected source
export interface ImageInput {
  role: ImagePortRole;
  label: string;
  urls: string[];
  sourceNodeId: string;
}

export interface ConnectedNodeInputs {
  textContent?: string;
  referenceUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
  productImageUrl?: string;
  characterImageUrl?: string;
  referenceImageUrls?: Record<string, string>;
  videoUrl?: string;
  videoId?: string;
  audioUrl?: string;
  // Structured image inputs keyed by label (for named port routing)
  imageInputs?: Record<string, ImageInput>;
  // Sora 2 character video references
  characterVideos?: Array<{ name: string; videoUrl: string }>;
}

// Resolution options per model type
export type FluxImageSize = 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';
export type NanoBananaResolution = '1K' | '2K' | '4K';

// Aspect ratio type (union of all supported)
export type AspectRatio = 'auto' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | '5:4' | '4:5';
export type FixedAspectRatio = Exclude<AspectRatio, 'auto'>;

export const DEFAULT_IMAGE_ASPECT_RATIO: FixedAspectRatio = '1:1';
const ASPECT_RATIO_MATCH_TOLERANCE = 0.06;
const FIXED_IMAGE_ASPECT_RATIOS: readonly FixedAspectRatio[] = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
  '5:4',
  '4:5',
] as const;
const FIXED_IMAGE_ASPECT_RATIO_VALUES: ReadonlyArray<{ ratio: FixedAspectRatio; value: number }> =
  FIXED_IMAGE_ASPECT_RATIOS.map((ratio) => {
    const [w, h] = ratio.split(':').map(Number);
    return { ratio, value: w / h };
  });

function findClosestAspectRatio(width: number, height: number): FixedAspectRatio | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const target = width / height;
  let closest: { ratio: FixedAspectRatio; delta: number } | null = null;

  for (const candidate of FIXED_IMAGE_ASPECT_RATIO_VALUES) {
    const delta = Math.abs(candidate.value - target);
    if (!closest || delta < closest.delta) {
      closest = { ratio: candidate.ratio, delta };
    }
  }

  return closest && closest.delta <= ASPECT_RATIO_MATCH_TOLERANCE ? closest.ratio : null;
}

function extractAspectRatioFromRegex(prompt: string, pattern: RegExp): FixedAspectRatio | null {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(prompt)) !== null) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    const ratio = findClosestAspectRatio(width, height);
    if (ratio) {
      return ratio;
    }
  }
  return null;
}

export function getAspectRatioLabel(aspectRatio: AspectRatio): string {
  return aspectRatio === 'auto' ? 'Auto' : aspectRatio;
}

export function normalizeAspectRatio(
  aspectRatio: unknown,
  fallback: AspectRatio = DEFAULT_IMAGE_ASPECT_RATIO
): AspectRatio {
  if (typeof aspectRatio !== 'string') {
    return fallback;
  }
  const normalized = aspectRatio.trim().toLowerCase();
  if (normalized === 'auto') {
    return 'auto';
  }

  return (FIXED_IMAGE_ASPECT_RATIOS as readonly string[]).includes(normalized)
    ? (normalized as FixedAspectRatio)
    : fallback;
}

export function extractExplicitAspectRatioFromPrompt(prompt: string): FixedAspectRatio | null {
  if (!prompt) {
    return null;
  }

  const explicitPattern = /(?:--ar|aspect\s*ratio|aspect|ratio|ar)\s*[:=]?\s*(\d{1,4}(?:\.\d+)?)\s*[:xX/]\s*(\d{1,4}(?:\.\d+)?)/gi;
  const standalonePattern = /\b(\d{1,4}(?:\.\d+)?)\s*[:xX/]\s*(\d{1,4}(?:\.\d+)?)\b/g;
  const dimensionsPattern = /\b(\d{3,5})\s*[xX×]\s*(\d{3,5})\b/g;

  return (
    extractAspectRatioFromRegex(prompt, explicitPattern) ||
    extractAspectRatioFromRegex(prompt, standalonePattern) ||
    extractAspectRatioFromRegex(prompt, dimensionsPattern)
  );
}

// Model input type - determines if model accepts text only, image input, or both
export type ModelInputType =
  | 'text-only'
  | 'text-and-image'
  | 'image-only'
  | 'text-and-audio'
  | 'video-and-text'
  | 'video-and-audio';

// Style types for different models
export type RecraftStyle = 'realistic_image' | 'digital_illustration' | 'vector_illustration';
export type IdeogramStyle = 'auto' | 'general' | 'realistic' | 'design' | '3d' | 'anime';

// Style labels for display
export const RECRAFT_STYLE_LABELS: Record<RecraftStyle, string> = {
  'realistic_image': 'Realistic',
  'digital_illustration': 'Digital',
  'vector_illustration': 'Vector',
} as const;

export const IDEOGRAM_STYLE_LABELS: Record<IdeogramStyle, string> = {
  'auto': 'Auto',
  'general': 'General',
  'realistic': 'Realistic',
  'design': 'Design',
  '3d': '3D',
  'anime': 'Anime',
} as const;

// All supported model types
export type ImageModelType =
  | 'auto'
  | 'flux-schnell'
  | 'flux-pro'
  | 'flux-2-pro'
  | 'flux-2-max'
  | 'flux-kontext'
  | 'nanobanana-pro'
  | 'nanobanana-2'
  | 'qwen-image-2'
  | 'qwen-image-2-pro'
  | 'grok-imagine-image'
  | 'grok-imagine-image-edit'
  | 'recraft-v3'
  | 'recraft-v4'
  | 'seedream-5'
  | 'ideogram-v3'
  | 'physic-edit'
  | 'firered-edit'
  | 'sd-3.5';

export type CompareRunStatus =
  | 'idle'
  | 'estimating'
  | 'confirming'
  | 'running'
  | 'completed'
  | 'partial_failed'
  | 'failed';

export type CompareResultStatus = 'queued' | 'running' | 'completed' | 'failed';

export const MAX_COMPARE_MODELS = 4;

export interface ImageCompareResult {
  id: string;
  model: ImageModelType;
  status: CompareResultStatus;
  estimatedCredits: number;
  outputUrl?: string;
  outputUrls?: string[];
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface VideoCompareResult {
  id: string;
  model: VideoModelType;
  status: CompareResultStatus;
  estimatedCredits: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  outputVideoId?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}


// Enabled models - comment/uncomment to toggle visibility in UI
// 'auto' is always available and not in this array
export const ENABLED_IMAGE_MODELS: ImageModelType[] = [
  'flux-schnell',
  'flux-pro',
  'flux-2-pro',
  'flux-2-max',
  'flux-kontext',
  'nanobanana-pro',
  'nanobanana-2',
  'qwen-image-2',
  'qwen-image-2-pro',
  'grok-imagine-image',
  'grok-imagine-image-edit',
  'recraft-v3',
  'recraft-v4',
  'seedream-5',
  'ideogram-v3',
  'physic-edit',
  'firered-edit',
];

// Image Generator Node
export interface ImageGeneratorNodeData extends Record<string, unknown> {
  name?: string;
  prompt: string;
  model: ImageModelType;
  aspectRatio: AspectRatio;
  // For Flux models: image size preset
  imageSize?: FluxImageSize;
  // For Nano Banana: resolution tier
  resolution?: NanoBananaResolution;
  imageCount?: number; // 1-4
  references?: ImageReference[]; // Style/character references
  refHandleCount?: number; // Number of reference handles to show (for multi-ref models)
  // New model-specific parameters
  style?: RecraftStyle | IdeogramStyle; // For Recraft and Ideogram
  magicPrompt?: boolean; // For Ideogram
  cfgScale?: number; // For SD 3.5 (1-20, default 7)
  steps?: number; // For SD 3.5 (10-50, default 30)
  strength?: number; // For SD 3.5 img2img (0-1, default 0.75)
  // Preset selections (stored separately)
  selectedCharacter?: CharacterSelection;
  selectedStyle?: StylePreset | null;
  selectedCameraAngle?: CameraAnglePreset | null;
  selectedCameraLens?: CameraLensPreset | null;
  // Named image port labels and roles (sourceNodeId → value)
  imageLabels?: Record<string, string>;
  imageRoles?: Record<string, ImagePortRole>;
  // Output
  outputUrl?: string;
  outputUrls?: string[]; // Array for multiple outputs
  compareEnabled?: boolean;
  compareModels?: ImageModelType[];
  compareRunStatus?: CompareRunStatus;
  compareEstimateCredits?: number;
  compareResults?: ImageCompareResult[];
  promotedCompareResultId?: string;
  compareHistoryId?: string;
  isGenerating?: boolean;
  error?: string;
}

export type ImageGeneratorNode = Node<ImageGeneratorNodeData, 'imageGenerator'>;

// Text Node
export interface TextNodeData extends Record<string, unknown> {
  content: string;
  name?: string;
  width?: number;
  height?: number;
  bgColor?: string;
  isExpanded?: boolean;
}

export type TextNode = Node<TextNodeData, 'text'>;

// Media Node
export interface MediaNodeData extends Record<string, unknown> {
  url?: string;
  type?: 'image' | 'video' | 'audio';
}

export type MediaNode = Node<MediaNodeData, 'media'>;

// Sticky Note Node
export type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';
export type StickyNoteSize = 'sm' | 'md' | 'lg';
export type TextAlign = 'left' | 'center' | 'right';

export interface StickyNoteNodeData extends Record<string, unknown> {
  content: string;
  author?: string;
  color: StickyNoteColor;
  size?: StickyNoteSize;
  textAlign?: TextAlign;
  fontSize?: number; // 12-24
  bold?: boolean;
  italic?: boolean;
  rotation?: number; // degrees
  opacity?: number; // 0-100
}

export type StickyNoteNode = Node<StickyNoteNodeData, 'stickyNote'>;

// Sticker Node
export type StickerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface StickerNodeData extends Record<string, unknown> {
  emoji: string;
  size: StickerSize;
  rotation?: number; // degrees (0-360)
  opacity?: number; // 0-100
  flipX?: boolean;
  flipY?: boolean;
}

export type StickerNode = Node<StickerNodeData, 'sticker'>;

// Group Node
export interface GroupNodeData extends Record<string, unknown> {
  name: string;
  color: string;
  width: number;
  height: number;
  notes?: string;
  childNodeIds?: string[];  // Explicit membership set by wrapInGroup — prevents cross-group adoption
}

export type GroupNode = Node<GroupNodeData, 'group'>;

// Plugin Node - Dynamic node rendered by plugins
export interface PluginNodeData extends Record<string, unknown> {
  pluginId: string;
  name?: string;
  state: Record<string, unknown>;
}

export type PluginNode = Node<PluginNodeData, 'pluginNode'>;

// Union of all node types
export type AppNode = ImageGeneratorNode | VideoGeneratorNode | TextNode | MediaNode | StickyNoteNode | StickerNode | GroupNode | StoryboardNode | ProductShotNode |  MusicGeneratorNode | SpeechNode | VideoAudioNode | PluginNode;
export type AppEdge = Edge;

// Fal API types
export interface FalGenerateRequest {
  prompt: string;
  model: string;
  image_size: {
    width: number;
    height: number;
  };
}

export interface FalGenerateResponse {
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

// Flux image size configurations (actual dimensions)
export const FLUX_IMAGE_SIZES: Record<FluxImageSize, { label: string; width: number; height: number }> = {
  'square_hd': { label: 'Square HD', width: 1024, height: 1024 },
  'square': { label: 'Square', width: 512, height: 512 },
  'portrait_4_3': { label: 'Portrait 4:3', width: 768, height: 1024 },
  'portrait_16_9': { label: 'Portrait 16:9', width: 576, height: 1024 },
  'landscape_4_3': { label: 'Landscape 4:3', width: 1024, height: 768 },
  'landscape_16_9': { label: 'Landscape 16:9', width: 1024, height: 576 },
} as const;

// Nano Banana resolution configurations
export const NANO_BANANA_RESOLUTIONS: Record<NanoBananaResolution, { label: string; description: string }> = {
  '1K': { label: '1K', description: 'Standard quality' },
  '2K': { label: '2K', description: 'High quality' },
  '4K': { label: '4K', description: 'Ultra quality (2x cost)' },
} as const;

// Aspect ratio to Flux image size mapping
export const ASPECT_TO_FLUX_SIZE: Record<string, FluxImageSize> = {
  '1:1': 'square_hd',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
} as const;

// Get dimensions for display (approximation based on aspect ratio)
export const getApproxDimensions = (aspectRatio: AspectRatio, model: string, resolution?: NanoBananaResolution) => {
  const effectiveAspectRatio = aspectRatio === 'auto' ? DEFAULT_IMAGE_ASPECT_RATIO : aspectRatio;

  if (model === 'nanobanana-pro' || model === 'nanobanana-2') {
    const baseSize = resolution === '4K' ? 4096 : resolution === '2K' ? 2048 : 1024;
    const [w, h] = effectiveAspectRatio.split(':').map(Number);
    const ratio = w / h;
    if (ratio >= 1) {
      return { width: baseSize, height: Math.round(baseSize / ratio) };
    } else {
      return { width: Math.round(baseSize * ratio), height: baseSize };
    }
  }
  // Flux models use preset sizes
  const fluxSize = ASPECT_TO_FLUX_SIZE[effectiveAspectRatio] || 'square_hd';
  return { width: FLUX_IMAGE_SIZES[fluxSize].width, height: FLUX_IMAGE_SIZES[fluxSize].height };
};

// Legacy export for backwards compatibility
export const ASPECT_RATIO_DIMENSIONS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 1024, height: 768 },
} as const;

// Model IDs for Fal
export const FAL_MODELS: Record<ImageModelType, string> = {
  'auto': '', // resolved at runtime
  'flux-schnell': 'fal-ai/flux/schnell',
  'flux-pro': 'fal-ai/flux-pro',
  'flux-2-pro': 'fal-ai/flux-2-pro',
  'flux-2-max': 'fal-ai/flux-2-max',
  'flux-kontext': 'fal-ai/flux-pro/kontext',
  'nanobanana-pro': 'fal-ai/nano-banana-pro',
  'nanobanana-2': 'fal-ai/nano-banana-2',
  'qwen-image-2': 'fal-ai/qwen-image-2/text-to-image',
  'qwen-image-2-pro': 'fal-ai/qwen-image-2/pro/text-to-image',
  'grok-imagine-image': 'xai/grok-imagine-image',
  'grok-imagine-image-edit': 'xai/grok-imagine-image/edit',
  'recraft-v3': 'fal-ai/recraft-v3',
  'recraft-v4': 'fal-ai/recraft/v4/text-to-image',
  'seedream-5': 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
  'ideogram-v3': 'fal-ai/ideogram/v3',
  'physic-edit': 'fal-ai/physic-edit',
  'firered-edit': 'fal-ai/firered-image-edit-v1.1',
  'sd-3.5': 'fal-ai/stable-diffusion-v35-large',
} as const;

// Aspect ratio mapping for NanoBanana Pro (uses string ratios)
export const ASPECT_RATIO_STRINGS = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3': '4:3',
} as const;

// Model capabilities configuration
export interface ModelCapabilities {
  label: string;
  group: string; // Category for grouped dropdown display
  maxImages: number;
  inputType: ModelInputType; // Whether model accepts images
  supportsReferences: boolean;
  requiresReferenceForGeneration?: boolean;
  maxReferences?: number; // Max reference images (default 1)
  aspectRatios: readonly AspectRatio[];
  // Flux uses image size presets, Nano Banana uses resolution tiers
  imageSizes?: readonly FluxImageSize[];
  resolutions?: readonly NanoBananaResolution[];
  // Style options (for Recraft and Ideogram)
  styles?: readonly RecraftStyle[] | readonly IdeogramStyle[];
  // Special features
  supportsMagicPrompt?: boolean; // Ideogram
  supportsAdvancedParams?: boolean; // SD 3.5 (CFG, steps, strength)
  supportsStrength?: boolean; // Image-to-image strength control when supported
  // Named image port roles (for structured model routing)
  supportedRoles?: ImagePortRole[];       // default ['reference']
  defaultRole?: ImagePortRole;            // default 'reference'
  roleConstraints?: Record<string, { max: number }>;
  description: string;
}

export const MODEL_CAPABILITIES: Record<ImageModelType, ModelCapabilities> = {
  'auto': {
    label: 'Auto',
    group: 'Auto',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 14,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    resolutions: ['1K', '2K', '4K'],
    description: 'Automatically picks the best model for quality, speed, and cost.',
  },
  'flux-schnell': {
    label: 'Flux Schnell',
    group: 'Flux',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: '12B Flux model for fast text-to-image in 1-4 denoising steps.',
  },
  'flux-pro': {
    label: 'Flux Pro',
    group: 'Flux',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 1,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'Professional-grade Flux model for premium quality commercial image generation.',
  },
  'nanobanana-pro': {
    label: 'Nano Banana Pro',
    group: 'Google',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 14,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    resolutions: ['1K', '2K', '4K'],
    description: 'Google Nano Banana Pro for state-of-the-art generation, editing, and typography.',
  },
  'nanobanana-2': {
    label: 'Nano Banana 2',
    group: 'Google',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 14,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    resolutions: ['1K', '2K', '4K'],
    description: 'Faster, lower-cost Nano Banana 2 for high-quality generation and editing.',
  },
  'qwen-image-2': {
    label: 'Qwen Image 2',
    group: 'Qwen',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 3,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'Qwen-Image 2 unified model for strong generation, editing, realism, and text.',
  },
  'qwen-image-2-pro': {
    label: 'Qwen Image 2 Pro',
    group: 'Qwen',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 3,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'Higher-fidelity Qwen-Image 2 Pro for advanced generation and editing workflows.',
  },
  'grok-imagine-image': {
    label: 'Grok Imagine Image',
    group: 'xAI Grok',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
    description: 'xAI Grok Imagine for direct text-to-image generation with broad aspect ratio support.',
  },
  'grok-imagine-image-edit': {
    label: 'Grok Imagine Edit',
    group: 'xAI Grok',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    requiresReferenceForGeneration: true,
    maxReferences: 3,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
    description: 'xAI Grok Imagine edit endpoint for prompt-guided image transformations with up to 3 references.',
  },
  'physic-edit': {
    label: 'Physic Edit',
    group: 'Fal Edit',
    maxImages: 1,
    inputType: 'text-and-image',
    supportsReferences: true,
    requiresReferenceForGeneration: true,
    maxReferences: 1,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    supportsAdvancedParams: true,
    description: 'Physics-aware image editing for realistic material, deformation, and refraction changes.',
  },
  'firered-edit': {
    label: 'FireRed Edit',
    group: 'Fal Edit',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    requiresReferenceForGeneration: true,
    maxReferences: 4,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    supportsAdvancedParams: true,
    description: 'FireRed multi-image editing with English and Chinese instructions. Supports multiple reference images.',
  },
  'recraft-v3': {
    label: 'Recraft V3',
    group: 'Recraft',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    styles: ['realistic_image', 'digital_illustration', 'vector_illustration'] as const,
    description: 'Recraft V3 for long text rendering, vector-style assets, and brand visuals.',
  },
  'ideogram-v3': {
    label: 'Ideogram V3',
    group: 'Ideogram',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    styles: ['auto', 'general', 'realistic', 'design', '3d', 'anime'] as const,
    supportsMagicPrompt: true,
    description: 'Ideogram V3 optimized for posters, logos, typography, and photoreal outputs.',
  },
  'sd-3.5': {
    label: 'SD 3.5 Large',
    group: 'Stability AI',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 1,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    supportsAdvancedParams: true,
    supportsStrength: true,
    description: 'Open Stable Diffusion 3.5 Large with strong prompt following and text rendering.',
  },
  'flux-2-pro': {
    label: 'FLUX.2 Pro',
    group: 'Flux',
    maxImages: 1,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 9,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'FLUX.2 Pro for high-quality generation and multi-reference editing (up to 9 references).',
  },
  'flux-2-max': {
    label: 'FLUX.2 Max',
    group: 'Flux',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'FLUX.2 Max for top-end realism, precision, and consistency in final renders.',
  },
  'flux-kontext': {
    label: 'Flux Kontext',
    group: 'Flux',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 1,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    description: 'FLUX Kontext for text+reference-guided local edits and scene transformations.',
  },
  'seedream-5': {
    label: 'Seedream 5.0',
    group: 'ByteDance',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    description: 'ByteDance Seedream 5.0 Lite for fast, high-quality text-to-image generation.',
  },
  'recraft-v4': {
    label: 'Recraft V4',
    group: 'Recraft',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
    styles: ['realistic_image', 'digital_illustration', 'vector_illustration'] as const,
    description: 'Designer-tuned Recraft V4 for refined composition, lighting, and brand consistency.',
  },
} as const;

// ============================================
// VIDEO GENERATION TYPES
// ============================================

// Video model types
export type VideoModelType =
  | 'auto'
  | 'veo-3'
  | 'veo-3.1-i2v'
  | 'veo-3.1-fast-i2v'
  | 'veo-3.1-ref'
  | 'veo-3.1-flf'
  | 'veo-3.1-fast-flf'
  | 'vidu-q3-t2v'
  | 'vidu-q3-i2v'
  | 'vidu-q3-t2v-turbo'
  | 'vidu-q3-i2v-turbo'
  | 'sora-2-t2v'
  | 'sora-2-i2v'
  | 'sora-2-pro-i2v'
  | 'sora-2-remix-v2v'
  | 'grok-imagine-t2v'
  | 'grok-imagine-i2v'
  | 'grok-imagine-edit-v2v'
  | 'ltx-2.3-i2v'
  | 'ltx-2.3-fast-t2v'
  | 'ltx-2.3-fast-i2v'
  | 'ltx-2.3-retake-v2v'
  | 'ltx-2.3-a2v'
  | 'ltx-2.3-extend'
  | 'ltx-2-19b-t2v'
  | 'ltx-2-19b-i2v'
  | 'ltx-2-19b-v2v'
  | 'ltx-2-19b-extend'
  | 'ltx-2-19b-a2v'
  | 'veed-fabric-1.0'
  | 'heygen-avatar4-i2v'
  | 'kling-2.6-t2v'
  | 'kling-2.6-i2v'
  | 'kling-o3-t2v'
  | 'kling-o3-i2v'
  | 'kling-o3-pro-i2v'
  | 'kling-3.0-t2v'
  | 'kling-3.0-i2v'
  | 'kling-3.0-pro-t2v'
  | 'kling-3.0-pro-i2v'
  | 'kling-3.0-mc'
  | 'kling-3.0-pro-mc'
  | 'seedance-1.5-t2v'
  | 'seedance-1.5-i2v'
  | 'seedance-1.0-pro-t2v'
  | 'seedance-1.0-pro-i2v'
  | 'seedance-2.0-t2v'
  | 'seedance-2.0-i2v'
  | 'seedance-2.0-fast-t2v'
  | 'seedance-2.0-fast-i2v'
  | 'wan-2.6-t2v'
  | 'wan-2.6-i2v'
  | 'hailuo-02-t2v'
  | 'hailuo-02-i2v'
  | 'hailuo-2.3-t2v'
  | 'hailuo-2.3-i2v'
  | 'luma-ray2'
  | 'minimax-video'
  | 'runway-gen3';

// Auto model constants — resolved at runtime
export const AUTO_IMAGE_MODEL: ImageModelType = 'nanobanana-2';
export const AUTO_VIDEO_TEXT_MODEL: VideoModelType = 'kling-3.0-t2v';
export const AUTO_VIDEO_IMAGE_MODEL: VideoModelType = 'kling-3.0-i2v';
export const AUTO_VIDEO_MODEL: VideoModelType = AUTO_VIDEO_TEXT_MODEL;

export interface VideoModelResolutionContext {
  referenceUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
}

export const TEMPORARILY_UNAVAILABLE_VIDEO_MODELS: VideoModelType[] = [
  'seedance-2.0-t2v',
  'seedance-2.0-i2v',
  'seedance-2.0-fast-t2v',
  'seedance-2.0-fast-i2v',
];

export const TEMPORARILY_UNAVAILABLE_VIDEO_MODEL_FALLBACKS: Partial<Record<VideoModelType, VideoModelType>> = {
  'seedance-2.0-t2v': 'kling-3.0-pro-t2v',
  'seedance-2.0-i2v': 'kling-3.0-pro-i2v',
  'seedance-2.0-fast-t2v': 'kling-3.0-t2v',
  'seedance-2.0-fast-i2v': 'kling-3.0-i2v',
};

function hasVideoImageContext(context?: VideoModelResolutionContext): boolean {
  return !!(
    context?.referenceUrl ||
    context?.firstFrameUrl ||
    context?.lastFrameUrl ||
    context?.referenceUrls?.length
  );
}

// Resolve 'auto' to the actual default model
export function resolveAutoModel(model: ImageModelType): ImageModelType {
  return model === 'auto' ? AUTO_IMAGE_MODEL : model;
}
export function resolveAutoVideoModel(
  model: VideoModelType,
  context?: VideoModelResolutionContext
): VideoModelType {
  if (model !== 'auto') return model;
  return hasVideoImageContext(context) ? AUTO_VIDEO_IMAGE_MODEL : AUTO_VIDEO_TEXT_MODEL;
}

export function resolveDeprecatedVideoModel(model: VideoModelType): VideoModelType {
  return TEMPORARILY_UNAVAILABLE_VIDEO_MODEL_FALLBACKS[model] ?? model;
}

export function resolveVideoModel(
  model: VideoModelType,
  context?: VideoModelResolutionContext
): VideoModelType {
  return resolveDeprecatedVideoModel(resolveAutoVideoModel(model, context));
}

// Video duration options (in seconds)
export type VideoDuration = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 15;

// Video aspect ratios
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

// Video resolution
export type VideoResolution = '360p' | '480p' | '540p' | '720p' | '1080p';

export interface VideoModelOptionOverrides {
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
}

export const DEFAULT_HEYGEN_AVATAR4_VOICE = 'Melissa';

// Heygen Avatar 4 voice options (from Fal model schema)
export const HEYGEN_AVATAR4_VOICES = [
  'Melissa',
  'Warm Pro Narrator',
  'Chill Brian',
  'Ivy',
  'John Doe',
  'Monika Sogam',
  'Hope',
  'Archer',
  'Brittney',
  'Patrick',
  'David Castlemore',
  'Michael C',
  'Adam Stone',
  'Juniper',
  'Cassidy',
  'Jessica Anne Bogart',
  'Arabella',
  'Andrew',
  'Spuds Oxley',
  'Grace Elder',
  'Helen',
  'Canyon Rivers',
  'Derya - Lifelike - Excited 🤩',
  'Mellow Marcus',
  'Jack Sterling - Broadcaster 🎙️',
  'Brenda - UGC - 1.mp4',
  'Reid',
  'Reagan',
  'Terry',
  'Jenny',
  'Radio Rick',
  'Denise',
  'Tim in car - Excited 🤩',
  'Iskander',
  'Thompson',
  'Delicate Daisy - Excited 🤩',
  'Kingston',
  'George UGC 1',
  'Bold Blake',
  'Jane',
  'Expressive Evan',
  'Marianne - IA',
  'Aaron',
  'Modern Recipe Host - Voice 1',
  'Willow',
  'Cute Chloe - Friendly 😊',
  'Rafael',
  'June - Lifelike',
  'Crisp Chloe',
  'Slick Simon',
  'Nassim - Informative',
  'Baritone Ben',
  'Maxwell',
  'Ellie Faye - Excited 🤩',
  'Milani',
  'Feisty Fiona - Excited 🤩',
  'Professor Dean',
  'Rose - UGC - 1.mp4',
  'Shona',
  'Hudson Wilder',
  'Ann - IA',
  'Alastair Kensington',
  'Oxley',
  'Christina',
  'Andrew Rizz',
  'Peyton',
  'Gerardo - Outdoor',
  'Chloe - Lifelike',
  'Stephanie',
  'Anthony - IA',
  'Signal - Voice 1',
  'Luca',
  'Lisa - Voice 1',
  'T.W.Tucker',
  'Jack Sullivan - Serious 😐',
  'Winter',
  'Mireia - Lifelike',
  'Georgia',
  'Stella',
  'Masha - Lifelike',
  'Charming Charles - Friendly 😊',
  'Serenity',
  'Annie - Excited',
  'Ralph',
  'Bethany',
  'Dominic',
  'Mason Finn',
  'Leena',
  'Veteran Victor',
  'Tamara',
  'Nik Public',
  'Calm Chloe',
  'Sevik',
  'Reilly',
  'Raul',
  'Imposing Ian',
  'Relaxed Ray',
  'Dexter - Professional',
  'Relaxed Rick',
  'Edwin',
  'Rupert Blackwood',
  'Ginny',
] as const;

export type HeygenAvatar4Voice = typeof HEYGEN_AVATAR4_VOICES[number] | (string & {});

// Video Generator Node Data
export interface VideoGeneratorNodeData extends Record<string, unknown> {
  name?: string;
  prompt: string;
  model: VideoModelType;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution?: VideoResolution;
  // Model-specific options
  generateAudio?: boolean; // For Veo 3, Kling 2.6
  heygenVoice?: HeygenAvatar4Voice; // For Heygen Avatar 4
  // Sora 2 character references
  characterNames?: Record<string, string>; // handle id → character name
  // Output
  outputUrl?: string;
  outputVideoId?: string; // For models that return reusable video IDs (e.g. Sora remix)
  thumbnailUrl?: string;
  compareEnabled?: boolean;
  compareModels?: VideoModelType[];
  compareRunStatus?: CompareRunStatus;
  compareEstimateCredits?: number;
  compareResults?: VideoCompareResult[];
  promotedCompareResultId?: string;
  compareHistoryId?: string;
  isGenerating?: boolean;
  progress?: number; // 0-100
  error?: string;
  // xskill async polling (Seedance 2.0 models)
  xskillTaskId?: string; // Active task being polled
  xskillTaskModel?: string; // Model label for saving
  xskillStatus?: 'pending' | 'processing'; // Current poll status for UI display
  xskillStartedAt?: number; // Timestamp when generation started (for elapsed timer)
}

export type VideoGeneratorNode = Node<VideoGeneratorNodeData, 'videoGenerator'>;

// Video input mode - determines what handles to show
export type VideoInputMode = 'text' | 'single-image' | 'first-last-frame' | 'multi-reference';

// Video model capabilities
export interface VideoModelCapabilities {
  label: string;
  group: string; // Category for grouped dropdown display
  inputType: ModelInputType;
  inputMode: VideoInputMode; // Determines which handles to show
  durations: readonly VideoDuration[];
  defaultDuration: VideoDuration; // Default duration for this model
  aspectRatios: readonly VideoAspectRatio[];
  resolutions?: readonly VideoResolution[];
  supportsAudio?: boolean;
  maxReferences?: number; // For multi-reference models (default 1)
  lastFrameOptional?: boolean; // For first-last-frame mode: if true, last frame is optional
  supportsVideoRef?: boolean; // Shows a video reference handle (for omni-reference models like Seedance 2.0)
  supportsAudioRef?: boolean; // Shows an audio reference handle (for Seedance 2.0 omni-reference)
  requiresPrompt?: boolean; // If false, prompt can be empty
  requiresImageRef?: boolean; // Requires at least one connected image input
  requiresVideoRef?: boolean; // Requires a connected video input URL
  requiresAudioRef?: boolean; // Requires a connected audio input URL
  requiresVideoId?: boolean; // Requires a reusable video ID (not just URL)
  supportsCharacterRef?: boolean; // Supports character video references (Sora 2)
  maxCharacters?: number; // Max character video references (default 2)
  promptTools?: readonly ('improve' | 'translate')[]; // Which prompt tool actions are available for this model
  description: string;
}

// Enabled video models - comment/uncomment to toggle visibility in UI
// 'auto' is always available and not in this array
export const ENABLED_VIDEO_MODELS: VideoModelType[] = [
  'veo-3',
  'veo-3.1-i2v',
  'veo-3.1-fast-i2v',
  'veo-3.1-ref',
  'veo-3.1-flf',
  'veo-3.1-fast-flf',
  'vidu-q3-t2v',
  'vidu-q3-i2v',
  'vidu-q3-t2v-turbo',
  'vidu-q3-i2v-turbo',
  'sora-2-t2v',
  'sora-2-i2v',
  'sora-2-pro-i2v',
  'sora-2-remix-v2v',
  'grok-imagine-t2v',
  'grok-imagine-i2v',
  'grok-imagine-edit-v2v',
  'ltx-2.3-i2v',
  'ltx-2.3-fast-t2v',
  'ltx-2.3-fast-i2v',
  'ltx-2.3-retake-v2v',
  'ltx-2.3-a2v',
  'ltx-2.3-extend',
  'ltx-2-19b-t2v',
  'ltx-2-19b-i2v',
  'ltx-2-19b-v2v',
  'ltx-2-19b-extend',
  'ltx-2-19b-a2v',
  'veed-fabric-1.0',
  'heygen-avatar4-i2v',
  'kling-2.6-t2v',
  'kling-2.6-i2v',
  'kling-o3-t2v',
  'kling-o3-i2v',
  'kling-o3-pro-i2v',
  'kling-3.0-t2v',
  'kling-3.0-i2v',
  'kling-3.0-pro-t2v',
  'kling-3.0-pro-i2v',
  'kling-3.0-mc',
  'kling-3.0-pro-mc',
  'seedance-1.5-t2v',
  'seedance-1.5-i2v',
  'seedance-1.0-pro-t2v',
  'seedance-1.0-pro-i2v',
  'wan-2.6-t2v',
  'wan-2.6-i2v',
  'hailuo-02-t2v',
  'hailuo-02-i2v',
  'hailuo-2.3-t2v',
  'hailuo-2.3-i2v',
  'luma-ray2',
  'minimax-video',
];

export const VIDEO_MODEL_CAPABILITIES: Record<VideoModelType, VideoModelCapabilities> = {
  'auto': {
    label: 'Auto',
    group: 'Auto',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    description: 'Automatically picks Kling 3.0 Text-to-Video or Kling 3.0 Image-to-Video based on your inputs.',
  },
  'veo-3': {
    label: 'Veo 3',
    group: 'Google Veo',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Google Veo 3 flagship text-to-video model with native sound generation.',
  },
  'veo-3.1-i2v': {
    label: 'Veo 3.1 Image-to-Video',
    group: 'Google Veo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Google Veo 3.1 image-to-video for high-fidelity motion from a single image.',
  },
  'veo-3.1-fast-i2v': {
    label: 'Veo 3.1 Fast Image-to-Video',
    group: 'Google Veo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Veo 3.1 Fast image-to-video for quicker generation at lower latency.',
  },
  'veo-3.1-ref': {
    label: 'Veo 3.1 Multi-Ref',
    group: 'Google Veo',
    inputType: 'text-and-image',
    inputMode: 'multi-reference',
    durations: [8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    maxReferences: 3,
    description: 'Veo 3.1 reference-to-video for stronger subject and style consistency.',
  },
  'veo-3.1-flf': {
    label: 'Veo 3.1 First-Last',
    group: 'Google Veo',
    inputType: 'image-only',
    inputMode: 'first-last-frame',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Veo 3.1 first/last-frame video interpolation with prompt-driven motion control.',
  },
  'veo-3.1-fast-flf': {
    label: 'Veo 3.1 Fast F-L',
    group: 'Google Veo',
    inputType: 'image-only',
    inputMode: 'first-last-frame',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Faster Veo 3.1 first/last-frame interpolation for rapid iterations.',
  },
  'vidu-q3-t2v': {
    label: 'Vidu Q3 Text',
    group: 'Vidu',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 8, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['360p', '540p', '720p', '1080p'],
    supportsAudio: true,
    description: 'Vidu Q3 Pro text-to-video with high quality cinematic motion and audio.',
  },
  'vidu-q3-i2v': {
    label: 'Vidu Q3 Image-to-Video',
    group: 'Vidu',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [4, 5, 6, 8, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['360p', '540p', '720p', '1080p'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Vidu Q3 Pro image-to-video with optional end-frame transition guidance.',
  },
  'vidu-q3-t2v-turbo': {
    label: 'Vidu Q3 Turbo Text',
    group: 'Vidu',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 8, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['360p', '540p', '720p', '1080p'],
    supportsAudio: true,
    description: 'Vidu Q3 Turbo text-to-video optimized for speed and cost efficiency.',
  },
  'vidu-q3-i2v-turbo': {
    label: 'Vidu Q3 Turbo Image-to-Video',
    group: 'Vidu',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [4, 5, 6, 8, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['360p', '540p', '720p', '1080p'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Vidu Q3 Turbo image-to-video optimized for fast turnaround.',
  },
  'sora-2-t2v': {
    label: 'Sora 2 Text',
    group: 'Sora 2',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 8, 12],
    defaultDuration: 4,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    supportsCharacterRef: true,
    maxCharacters: 2,
    description: 'OpenAI Sora 2 text-to-video for richly detailed, dynamic clips with audio.',
  },
  'sora-2-i2v': {
    label: 'Sora 2 Image-to-Video',
    group: 'Sora 2',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 8, 12],
    defaultDuration: 4,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    requiresPrompt: true,
    requiresImageRef: true,
    supportsCharacterRef: true,
    maxCharacters: 2,
    description: 'OpenAI Sora 2 image-to-video for detailed motion and native audio.',
  },
  'sora-2-pro-i2v': {
    label: 'Sora 2 Pro Image-to-Video',
    group: 'Sora 2',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 8, 12],
    defaultDuration: 4,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    requiresPrompt: true,
    requiresImageRef: true,
    supportsCharacterRef: true,
    maxCharacters: 2,
    description: 'OpenAI Sora 2 Pro image-to-video for highest fidelity and motion quality.',
  },
  'sora-2-remix-v2v': {
    label: 'Sora 2 Remix',
    group: 'Sora 2',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 8, 12],
    defaultDuration: 4,
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxReferences: 0,
    supportsVideoRef: true,
    requiresPrompt: true,
    requiresVideoRef: true,
    requiresVideoId: true,
    description: 'Sora 2 video remix for prompt-based restyling while preserving scene structure.',
  },
  'grok-imagine-t2v': {
    label: 'Grok Imagine Text',
    group: 'xAI Grok',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 6, 8, 10],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p'],
    description: 'xAI Grok Imagine text-to-video with synchronized audio output.',
  },
  'grok-imagine-i2v': {
    label: 'Grok Imagine Image-to-Video',
    group: 'xAI Grok',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 6, 8, 10],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p'],
    requiresPrompt: true,
    requiresImageRef: true,
    description: 'xAI Grok Imagine image-to-video with synchronized audio output.',
  },
  'grok-imagine-edit-v2v': {
    label: 'Grok Imagine Edit',
    group: 'xAI Grok',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 6, 8, 10],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p'],
    maxReferences: 0,
    supportsVideoRef: true,
    requiresPrompt: true,
    requiresVideoRef: true,
    description: 'xAI Grok Imagine video editing/remix from existing video inputs.',
  },
  'ltx-2.3-i2v': {
    label: 'LTX 2.3 Image-to-Video',
    group: 'LTX',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [6, 8, 10],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['1080p'],
    supportsAudio: true,
    requiresPrompt: true,
    requiresImageRef: true,
    lastFrameOptional: true,
    description: 'LTX 2.3 Pro image-to-video at the 1080p tier with optional end-frame guidance and audio.',
  },
  'ltx-2.3-fast-t2v': {
    label: 'LTX 2.3 Fast Text',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [6, 8, 10, 12],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['1080p'],
    supportsAudio: true,
    requiresPrompt: true,
    description: 'LTX 2.3 Fast text-to-video at the 1080p tier with native audio generation.',
  },
  'ltx-2.3-fast-i2v': {
    label: 'LTX 2.3 Fast Image-to-Video',
    group: 'LTX',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [6, 8, 10, 12],
    defaultDuration: 6,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['1080p'],
    supportsAudio: true,
    requiresPrompt: true,
    requiresImageRef: true,
    lastFrameOptional: true,
    description: 'LTX 2.3 Fast image-to-video at the 1080p tier with optional end-frame guidance and audio.',
  },
  'ltx-2.3-retake-v2v': {
    label: 'LTX 2.3 Retake',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 6, 8, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsVideoRef: true,
    requiresPrompt: true,
    requiresVideoRef: true,
    description: 'LTX 2.3 Pro video retake — reshoot a video with a new prompt while preserving structure.',
  },
  'ltx-2.3-a2v': {
    label: 'LTX 2.3 Audio-to-Video',
    group: 'LTX',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5, 6, 8, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudioRef: true,
    requiresAudioRef: true,
    lastFrameOptional: true,
    description: 'LTX 2.3 Pro audio-to-video — generate video driven by an audio track with optional image guidance.',
  },
  'ltx-2.3-extend': {
    label: 'LTX 2.3 Extend',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 6, 8, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsVideoRef: true,
    requiresVideoRef: true,
    description: 'LTX 2.3 Pro video extension — extend a video from start or end with coherent continuation.',
  },
  'ltx-2-19b-t2v': {
    label: 'LTX 2 19B Text',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportsAudio: true,
    requiresPrompt: true,
    description: 'LTX-2 19B text-to-video with integrated audio generation.',
  },
  'ltx-2-19b-i2v': {
    label: 'LTX 2 19B Image-to-Video',
    group: 'LTX',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [4, 5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportsAudio: true,
    requiresPrompt: true,
    lastFrameOptional: true,
    description: 'LTX-2 19B image-to-video with optional end-frame and audio support.',
  },
  'ltx-2-19b-v2v': {
    label: 'LTX 2 19B Video',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportsAudio: true,
    supportsVideoRef: true,
    supportsAudioRef: true,
    maxReferences: 1,
    requiresPrompt: true,
    requiresVideoRef: true,
    description: 'LTX-2 19B video-to-video transformation with prompt and audio conditioning.',
  },
  'ltx-2-19b-extend': {
    label: 'LTX 2 19B Extend',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportsAudio: true,
    supportsVideoRef: true,
    maxReferences: 0,
    requiresPrompt: true,
    requiresVideoRef: true,
    description: 'LTX-2 19B video extension for coherent continuation beyond the original clip.',
  },
  'ltx-2-19b-a2v': {
    label: 'LTX 2 19B Audio',
    group: 'LTX',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportsAudioRef: true,
    maxReferences: 1,
    requiresPrompt: true,
    requiresAudioRef: true,
    description: 'LTX-2 19B audio-to-video from audio, prompt, and optional image reference.',
  },
  'veed-fabric-1.0': {
    label: 'Veed Fabric 1.0',
    group: 'Veed',
    inputType: 'image-only',
    inputMode: 'text',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    supportsAudioRef: true,
    maxReferences: 1,
    requiresPrompt: false,
    requiresImageRef: true,
    requiresAudioRef: true,
    description: 'VEED Fabric 1.0 lip-sync model turning a single image into a talking video.',
  },
  'heygen-avatar4-i2v': {
    label: 'Heygen Avatar 4',
    group: 'Heygen',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['360p', '480p', '540p', '720p', '1080p'],
    requiresPrompt: true,
    requiresImageRef: true,
    description: 'Heygen Avatar 4 talking portrait generation from one image and a script.',
  },
  'kling-2.6-t2v': {
    label: 'Kling 2.6 Text',
    group: 'Kling',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    description: 'Kling 2.6 Pro text-to-video with cinematic visuals, fluid motion, and audio.',
  },
  'kling-2.6-i2v': {
    label: 'Kling 2.6 Image-to-Video',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Kling 2.6 Pro image-to-video with cinematic visuals, fluid motion, and audio.',
  },
  'kling-o3-t2v': {
    label: 'Kling O3 Text',
    group: 'Kling',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    description: 'Kling O3 Pro text-to-video for realistic motion and cinematic scene control.',
  },
  'kling-o3-i2v': {
    label: 'Kling O3 Image-to-Video',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Kling O3 Standard image-to-video with strong frame-to-frame transition control.',
  },
  'kling-o3-pro-i2v': {
    label: 'Kling O3 Pro Image-to-Video',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Kling O3 Pro image-to-video with enhanced fidelity and transition quality.',
  },
  'kling-3.0-t2v': {
    label: 'Kling 3.0 Text',
    group: 'Kling',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    description: 'Kling 3.0 Standard text-to-video with multi-shot support and native audio.',
  },
  'kling-3.0-i2v': {
    label: 'Kling 3.0 Image-to-Video',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Kling 3.0 Standard image-to-video with custom element support and audio.',
  },
  'kling-3.0-pro-t2v': {
    label: 'Kling 3.0 Pro Text',
    group: 'Kling',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    description: 'Kling 3.0 Pro text-to-video for premium multi-shot cinematic generation.',
  },
  'kling-3.0-pro-i2v': {
    label: 'Kling 3.0 Pro Image-to-Video',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Kling 3.0 Pro image-to-video for highest quality custom-element animation.',
  },
  'kling-3.0-mc': {
    label: 'Kling 3.0 Motion Control',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsVideoRef: true,
    requiresImageRef: true,
    requiresVideoRef: true,
    description: 'Kling 3.0 Standard motion control — transfer actions from a reference video onto a reference image.',
  },
  'kling-3.0-pro-mc': {
    label: 'Kling 3.0 Pro Motion Control',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsVideoRef: true,
    requiresImageRef: true,
    requiresVideoRef: true,
    description: 'Kling 3.0 Pro motion control — premium quality action transfer from video to image.',
  },
  'seedance-1.5-t2v': {
    label: 'Seedance 1.5 Text',
    group: 'Seedance',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    supportsAudio: true,
    promptTools: ['improve', 'translate'],
    description: 'ByteDance Seedance 1.5 Pro text-to-video with native audio generation.',
  },
  'seedance-1.5-i2v': {
    label: 'Seedance 1.5 Image-to-Video',
    group: 'Seedance',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    supportsAudio: true,
    lastFrameOptional: true,
    promptTools: ['improve', 'translate'],
    description: 'ByteDance Seedance 1.5 Pro image-to-video with optional end frame and audio.',
  },
  'seedance-1.0-pro-t2v': {
    label: 'Seedance 1.0 Pro Text',
    group: 'Seedance',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    promptTools: ['improve', 'translate'],
    description: 'Seedance 1.0 Pro text-to-video with 1080p output and multi-shot storytelling.',
  },
  'seedance-1.0-pro-i2v': {
    label: 'Seedance 1.0 Pro Image-to-Video',
    group: 'Seedance',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    promptTools: ['improve', 'translate'],
    description: 'Seedance 1.0 Pro image-to-video with 1080p output and multi-shot control.',
  },
  'seedance-2.0-t2v': {
    label: 'Seedance 2.0 Text',
    group: 'Seedance 2.0',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    promptTools: ['improve', 'translate'],
    description: 'Seedance 2.0 multimodal text-to-video with director-level control and audio-video sync.',
  },
  'seedance-2.0-i2v': {
    label: 'Seedance 2.0 Image-to-Video',
    group: 'Seedance 2.0',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    maxReferences: 3,
    supportsVideoRef: true,
    supportsAudioRef: true,
    promptTools: ['improve', 'translate'],
    description: 'Seedance 2.0 multimodal image-to-video with strong reference consistency and editing.',
  },
  'seedance-2.0-fast-t2v': {
    label: 'Seedance 2.0 Fast Text',
    group: 'Seedance 2.0',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    promptTools: ['improve', 'translate'],
    description: 'Faster Seedance 2.0 text-to-video variant for lower latency multimodal workflows.',
  },
  'seedance-2.0-fast-i2v': {
    label: 'Seedance 2.0 Fast Image-to-Video',
    group: 'Seedance 2.0',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    maxReferences: 3,
    supportsVideoRef: true,
    supportsAudioRef: true,
    promptTools: ['improve', 'translate'],
    description: 'Faster Seedance 2.0 image-to-video variant with multimodal reference support.',
  },
  'luma-ray2': {
    label: 'Luma Ray 2',
    group: 'Other',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5, 9],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1'],
    resolutions: ['540p', '720p', '1080p'],
    description: 'Luma Dream Machine video generation with natural motion and cinematic camera movement.',
  },
  'minimax-video': {
    label: 'Minimax',
    group: 'Other',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'MiniMax image-to-video endpoint for fast general-purpose video generation.',
  },
  'runway-gen3': {
    label: 'Runway Gen-3',
    group: 'Other',
    inputType: 'image-only',
    inputMode: 'single-image',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16'],
    description: 'Runway Gen-3 Turbo image-to-video (currently unavailable in Fal integration).',
  },
  'wan-2.6-t2v': {
    label: 'Wan 2.6 Text',
    group: 'Wan',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [3, 5, 7, 9],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    description: 'Wan 2.6 text-to-video with multi-shot generation, audio input, and 720p/1080p output.',
  },
  'wan-2.6-i2v': {
    label: 'Wan 2.6 Image-to-Video',
    group: 'Wan',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [3, 5, 7, 9],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    description: 'Wan 2.6 image-to-video with prompt-guided motion, multi-shot support, and audio input.',
  },
  'hailuo-02-t2v': {
    label: 'Hailuo 02 Text',
    group: 'Hailuo',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'MiniMax Hailuo 02 Pro text-to-video with advanced generation at 1080p.',
  },
  'hailuo-02-i2v': {
    label: 'Hailuo 02 Image-to-Video',
    group: 'Hailuo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'MiniMax Hailuo 02 Pro image-to-video with advanced generation at 1080p.',
  },
  'hailuo-2.3-t2v': {
    label: 'Hailuo 2.3 Text',
    group: 'Hailuo',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'MiniMax Hailuo 2.3 Pro text-to-video with 1080p output.',
  },
  'hailuo-2.3-i2v': {
    label: 'Hailuo 2.3 Image-to-Video',
    group: 'Hailuo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'MiniMax Hailuo 2.3 Fast Pro image-to-video with 1080p output.',
  },
} as const;

function getClosestVideoDuration(
  durations: readonly VideoDuration[],
  duration: number | undefined,
  fallback: VideoDuration
): VideoDuration {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return fallback;
  const exact = durations.find((value) => value === duration);
  if (exact) return exact;

  return durations.reduce((best, candidate) => (
    Math.abs(candidate - duration) < Math.abs(best - duration) ? candidate : best
  ), fallback);
}

export function normalizeVideoModelOptions(
  model: VideoModelType,
  options: VideoModelOptionOverrides
): {
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution?: VideoResolution;
} {
  const capabilities = VIDEO_MODEL_CAPABILITIES[model];
  const aspectRatio = capabilities.aspectRatios.includes(options.aspectRatio as VideoAspectRatio)
    ? options.aspectRatio as VideoAspectRatio
    : capabilities.aspectRatios[0];
  const duration = getClosestVideoDuration(
    capabilities.durations,
    options.duration,
    capabilities.defaultDuration
  );

  if (!capabilities.resolutions) {
    return {
      aspectRatio,
      duration,
    };
  }

  const resolution = capabilities.resolutions.includes(options.resolution as VideoResolution)
    ? options.resolution as VideoResolution
    : capabilities.resolutions[0];

  return {
    aspectRatio,
    duration,
    resolution,
  };
}

// Video model API provider
export type VideoModelProvider = 'fal' | 'xskill';

/** Which API provider each model uses */
export const VIDEO_MODEL_PROVIDERS: Record<VideoModelType, VideoModelProvider> = {
  'auto': 'fal', // resolved at runtime
  'veo-3': 'fal',
  'veo-3.1-i2v': 'fal',
  'veo-3.1-fast-i2v': 'fal',
  'veo-3.1-ref': 'fal',
  'veo-3.1-flf': 'fal',
  'veo-3.1-fast-flf': 'fal',
  'vidu-q3-t2v': 'fal',
  'vidu-q3-i2v': 'fal',
  'vidu-q3-t2v-turbo': 'fal',
  'vidu-q3-i2v-turbo': 'fal',
  'sora-2-t2v': 'fal',
  'sora-2-i2v': 'fal',
  'sora-2-pro-i2v': 'fal',
  'sora-2-remix-v2v': 'fal',
  'grok-imagine-t2v': 'fal',
  'grok-imagine-i2v': 'fal',
  'grok-imagine-edit-v2v': 'fal',
  'ltx-2.3-i2v': 'fal',
  'ltx-2.3-fast-t2v': 'fal',
  'ltx-2.3-fast-i2v': 'fal',
  'ltx-2.3-retake-v2v': 'fal',
  'ltx-2.3-a2v': 'fal',
  'ltx-2.3-extend': 'fal',
  'ltx-2-19b-t2v': 'fal',
  'ltx-2-19b-i2v': 'fal',
  'ltx-2-19b-v2v': 'fal',
  'ltx-2-19b-extend': 'fal',
  'ltx-2-19b-a2v': 'fal',
  'veed-fabric-1.0': 'fal',
  'heygen-avatar4-i2v': 'fal',
  'kling-2.6-t2v': 'fal',
  'kling-2.6-i2v': 'fal',
  'kling-o3-t2v': 'fal',
  'kling-o3-i2v': 'fal',
  'kling-o3-pro-i2v': 'fal',
  'kling-3.0-t2v': 'fal',
  'kling-3.0-i2v': 'fal',
  'kling-3.0-pro-t2v': 'fal',
  'kling-3.0-pro-i2v': 'fal',
  'kling-3.0-mc': 'fal',
  'kling-3.0-pro-mc': 'fal',
  'seedance-1.5-t2v': 'fal',
  'seedance-1.5-i2v': 'fal',
  'seedance-1.0-pro-t2v': 'fal',
  'seedance-1.0-pro-i2v': 'fal',
  'seedance-2.0-t2v': 'xskill',
  'seedance-2.0-i2v': 'xskill',
  'seedance-2.0-fast-t2v': 'xskill',
  'seedance-2.0-fast-i2v': 'xskill',
  'luma-ray2': 'fal',
  'wan-2.6-t2v': 'fal',
  'wan-2.6-i2v': 'fal',
  'hailuo-02-t2v': 'fal',
  'hailuo-02-i2v': 'fal',
  'hailuo-2.3-t2v': 'fal',
  'hailuo-2.3-i2v': 'fal',
  'minimax-video': 'fal',
  'runway-gen3': 'fal',
} as const;

// Fal model IDs for video (only for provider === 'fal')
export const FAL_VIDEO_MODELS: Partial<Record<VideoModelType, string>> = {
  'veo-3': 'fal-ai/veo3',
  'veo-3.1-i2v': 'fal-ai/veo3.1/image-to-video',
  'veo-3.1-fast-i2v': 'fal-ai/veo3.1/fast/image-to-video',
  'veo-3.1-ref': 'fal-ai/veo3.1/reference-to-video',
  'veo-3.1-flf': 'fal-ai/veo3.1/first-last-frame-to-video',
  'veo-3.1-fast-flf': 'fal-ai/veo3.1/fast/first-last-frame-to-video',
  'vidu-q3-t2v': 'fal-ai/vidu/q3/text-to-video',
  'vidu-q3-i2v': 'fal-ai/vidu/q3/image-to-video',
  'vidu-q3-t2v-turbo': 'fal-ai/vidu/q3/text-to-video/turbo',
  'vidu-q3-i2v-turbo': 'fal-ai/vidu/q3/image-to-video/turbo',
  'sora-2-t2v': 'fal-ai/sora-2/text-to-video',
  'sora-2-i2v': 'fal-ai/sora-2/image-to-video',
  'sora-2-pro-i2v': 'fal-ai/sora-2/image-to-video/pro',
  'sora-2-remix-v2v': 'fal-ai/sora-2/video-to-video/remix',
  'grok-imagine-t2v': 'xai/grok-imagine-video/text-to-video',
  'grok-imagine-i2v': 'xai/grok-imagine-video/image-to-video',
  'grok-imagine-edit-v2v': 'xai/grok-imagine-video/edit-video',
  'ltx-2.3-i2v': 'fal-ai/ltx-2.3/image-to-video',
  'ltx-2.3-fast-t2v': 'fal-ai/ltx-2.3/text-to-video/fast',
  'ltx-2.3-fast-i2v': 'fal-ai/ltx-2.3/image-to-video/fast',
  'ltx-2.3-retake-v2v': 'fal-ai/ltx-2.3/retake-video',
  'ltx-2.3-a2v': 'fal-ai/ltx-2.3/audio-to-video',
  'ltx-2.3-extend': 'fal-ai/ltx-2.3/extend-video',
  'ltx-2-19b-t2v': 'fal-ai/ltx-2-19b/text-to-video',
  'ltx-2-19b-i2v': 'fal-ai/ltx-2-19b/image-to-video',
  'ltx-2-19b-v2v': 'fal-ai/ltx-2-19b/video-to-video',
  'ltx-2-19b-extend': 'fal-ai/ltx-2-19b/extend-video',
  'ltx-2-19b-a2v': 'fal-ai/ltx-2-19b/audio-to-video',
  'veed-fabric-1.0': 'veed/fabric-1.0',
  'heygen-avatar4-i2v': 'fal-ai/heygen/avatar4/image-to-video',
  'kling-2.6-t2v': 'fal-ai/kling-video/v2.6/pro/text-to-video',
  'kling-2.6-i2v': 'fal-ai/kling-video/v2.6/pro/image-to-video',
  'kling-o3-t2v': 'fal-ai/kling-video/o3/pro/text-to-video',
  'kling-o3-i2v': 'fal-ai/kling-video/o3/standard/image-to-video',
  'kling-o3-pro-i2v': 'fal-ai/kling-video/o3/pro/image-to-video',
  'kling-3.0-t2v': 'fal-ai/kling-video/v3/standard/text-to-video',
  'kling-3.0-i2v': 'fal-ai/kling-video/v3/standard/image-to-video',
  'kling-3.0-pro-t2v': 'fal-ai/kling-video/v3/pro/text-to-video',
  'kling-3.0-pro-i2v': 'fal-ai/kling-video/v3/pro/image-to-video',
  'kling-3.0-mc': 'fal-ai/kling-video/v3/standard/motion-control',
  'kling-3.0-pro-mc': 'fal-ai/kling-video/v3/pro/motion-control',
  'seedance-1.5-t2v': 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
  'seedance-1.5-i2v': 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  'seedance-1.0-pro-t2v': 'fal-ai/bytedance/seedance/v1/pro/text-to-video',
  'seedance-1.0-pro-i2v': 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
  'luma-ray2': 'fal-ai/luma-dream-machine',
  'wan-2.6-t2v': 'fal-ai/wan/v2.6/text-to-video',
  'wan-2.6-i2v': 'fal-ai/wan/v2.6/image-to-video',
  'hailuo-02-t2v': 'fal-ai/minimax/hailuo-02/pro/text-to-video',
  'hailuo-02-i2v': 'fal-ai/minimax/hailuo-02/pro/image-to-video',
  'hailuo-2.3-t2v': 'fal-ai/minimax/hailuo-2.3-fast/pro/text-to-video',
  'hailuo-2.3-i2v': 'fal-ai/minimax/hailuo-2.3-fast/pro/image-to-video',
  'minimax-video': 'fal-ai/minimax-video/image-to-video',
  'runway-gen3': 'fal-ai/runway-gen3/turbo/image-to-video',
} as const;

// xskill.ai outer model IDs (only for provider === 'xskill')
export const XSKILL_VIDEO_MODELS: Partial<Record<VideoModelType, string>> = {
  'seedance-2.0-t2v': 'st-ai/super-seed2',
  'seedance-2.0-i2v': 'st-ai/super-seed2',
  'seedance-2.0-fast-t2v': 'st-ai/super-seed2',
  'seedance-2.0-fast-i2v': 'st-ai/super-seed2',
} as const;

// ============================================
// STORYBOARD NODE TYPES
// ============================================

// Storyboard reference roles
export type StoryboardReferenceRole = 'subject' | 'character' | 'prop' | 'environment';

// Storyboard reference (N-ref support)
export interface StoryboardReference {
  id: string;                      // Stable unique ID (e.g., 'ref_abc123')
  role: StoryboardReferenceRole;
  label: string;                   // Short name (e.g., "Charmander")
  description: string;             // Detailed description
  handleId: string;                // Input handle ID on the node (e.g., 'refImage_0')
}

// AI-generated identity for a reference
export interface StoryboardReferenceIdentity {
  refId: string;                   // Links to StoryboardReference.id
  label: string;
  role: StoryboardReferenceRole;
  identity: string;                // AI-generated visual identity description
}

// Storyboard mode
export type StoryboardMode = 'transition' | 'single-shot';

// Storyboard target video model family
export type StoryboardVideoModel = 'veo' | 'kling' | 'seedance';

// Storyboard visual style
export type StoryboardStyle = 'cinematic' | 'anime' | 'photorealistic' | 'illustrated' | 'commercial';

// Storyboard view state
export type StoryboardViewState = 'form' | 'loading' | 'preview' | 'chat';

// Storyboard chat phase
export type StoryboardChatPhase = 'idle' | 'streaming' | 'draft-ready' | 'error';

// Storyboard chat message
export interface StoryboardChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  seq: number;
}

// Storyboard thinking block entry
export interface StoryboardThinkingBlock {
  id: string;
  label: string;
  reasoning?: string;
  startedAt: string;
  endedAt?: string;
  seq: number;
}

// Storyboard draft entry
export interface StoryboardDraft {
  id: string;
  scenes: StoryboardSceneData[];
  summary: string;
  /** @deprecated Use referenceIdentities instead */
  productIdentity?: string;
  /** @deprecated Use referenceIdentities instead */
  characterIdentity?: string;
  /** AI-generated identities for each reference (N-ref support) */
  referenceIdentities?: StoryboardReferenceIdentity[];
  createdAt: string;
  seq: number;
}

// Scene data structure (matches schema.ts)
export interface StoryboardSceneData {
  number: number;
  title: string;
  description: string;
  prompt: string;
  camera: string;
  mood: string;
  transition?: string;  // For transition mode (motion between scenes)
  motion?: string;      // For single-shot mode (motion within scene)
  negativePrompt?: string;  // What to exclude from generation
  audioDirection?: string;  // Sound design cues (SFX, ambient, dialogue)
  videoAspectRatio?: string;  // Per-scene video aspect ratio chosen by AI (e.g. '16:9', '9:16')
  videoDuration?: number;     // Per-scene video duration in seconds chosen by AI
  /** Which reference IDs appear in this scene (AI-decided, N-ref support) */
  referenceIds?: string[];
}

// Storyboard draft identity fields
export interface StoryboardDraftIdentity {
  productIdentity?: string;
  characterIdentity?: string;
}

// Storyboard Node Data
export interface StoryboardNodeData extends Record<string, unknown> {
  name?: string;
  // Form fields — N-ref support
  references: StoryboardReference[];
  /** @deprecated Use references instead — kept for backward compat migration */
  product?: string;
  /** @deprecated Use references instead — kept for backward compat migration */
  character?: string;
  concept: string;
  sceneCount: number;
  style: StoryboardStyle;
  mode: StoryboardMode;  // 'transition' for N-1 videos between frames, 'single-shot' for N independent videos
  targetVideoModel: StoryboardVideoModel;  // Target video model family for prompt optimization
  videoRecipes?: string[];  // Selected video recipe preset IDs
  // UI state
  viewState: StoryboardViewState;
  error?: string;
  // Chat / iterative refinement state
  chatMessages: StoryboardChatMessage[];
  thinkingBlocks: StoryboardThinkingBlock[];
  drafts: StoryboardDraft[];
  activeDraftIndex?: number;
  chatPhase: StoryboardChatPhase;
  // Legacy fields (deprecated, kept for backward compat migration)
  thinkingText?: string;
  reasoningText?: string;
  thinkingStartedAt?: string;
  isStreaming?: boolean;
  result?: {
    scenes: StoryboardSceneData[];
    summary: string;
  };
}

export type StoryboardNode = Node<StoryboardNodeData, 'storyboard'>;

// ============================================
// PRODUCT SHOT NODE TYPES
// ============================================

// Product shot background preset
export type ProductShotBackground = 'studio-white' | 'gradient' | 'lifestyle' | 'outdoor' | 'dark-moody';

// Product shot lighting preset
export type ProductShotLighting = 'soft' | 'dramatic' | 'natural' | 'rim-light';

// Product shot view state
export type ProductShotViewState = 'form' | 'loading' | 'preview';

// Single shot data structure (matches schema.ts)
export interface ProductShotShotData {
  number: number;
  angleName: string;
  description: string;
  prompt: string;
  camera: string;
  composition: string;
  enabled: boolean;
}

// Product Shot Node Data
export interface ProductShotNodeData extends Record<string, unknown> {
  name?: string;
  // Form fields
  productName: string;
  shotCount: number;
  background: ProductShotBackground;
  lighting: ProductShotLighting;
  additionalNotes?: string;
  // UI state
  viewState: ProductShotViewState;
  error?: string;
  // Generated result (stored for persistence)
  result?: {
    shots: ProductShotShotData[];
    summary: string;
  };
}

export type ProductShotNode = Node<ProductShotNodeData, 'productShot'>;

// ============================================
// AUDIO GENERATION TYPES
// ============================================

// Audio model types
export type SpeechModelType = 'elevenlabs-tts' | 'lux-tts' | 'tada-3b-tts';
export const SPEECH_MODEL_OPTIONS: readonly SpeechModelType[] = [
  'elevenlabs-tts',
  'lux-tts',
  'tada-3b-tts',
] as const;

export type VideoAudioModelType = 'mmaudio-v2' | 'sync-lipsync-v2-pro';
export const VIDEO_AUDIO_MODEL_OPTIONS: readonly VideoAudioModelType[] = [
  'mmaudio-v2',
  'sync-lipsync-v2-pro',
] as const;

export type AudioModelType = 'ace-step' | SpeechModelType | VideoAudioModelType;
export type TadaLanguage = 'en' | 'ar' | 'ch' | 'de' | 'es' | 'fr' | 'it' | 'ja' | 'pl' | 'pt';
export type SyncLipsyncMode = 'cut_off' | 'loop' | 'bounce' | 'silence' | 'remap';

export const TADA_LANGUAGE_LABELS: Record<TadaLanguage, string> = {
  en: 'English',
  ar: 'Arabic',
  ch: 'Chinese',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  pl: 'Polish',
  pt: 'Portuguese',
} as const;

export const SYNC_LIPSYNC_MODE_LABELS: Record<SyncLipsyncMode, string> = {
  cut_off: 'Cut Off',
  loop: 'Loop',
  bounce: 'Bounce',
  silence: 'Silence',
  remap: 'Remap',
} as const;

// Music duration options (in seconds)
export type MusicDuration = 5 | 15 | 30 | 60 | 120 | 180 | 240;

// ElevenLabs voice options
// Keep legacy defaults for backwards compatibility, but allow any runtime voice id/name from Fal list-voices.
export const DEFAULT_ELEVENLABS_VOICE_LABELS = {
  'alloy': 'Alloy (Neutral)',
  'echo': 'Echo (Male)',
  'fable': 'Fable (British)',
  'onyx': 'Onyx (Deep Male)',
  'nova': 'Nova (Female)',
  'shimmer': 'Shimmer (Soft Female)',
  'rachel': 'Rachel (Calm)',
  'drew': 'Drew (Confident)',
  'clyde': 'Clyde (War Veteran)',
  'paul': 'Paul (News)',
  'domi': 'Domi (Strong)',
  'dave': 'Dave (British Conversational)',
  'fin': 'Fin (Irish)',
  'sarah': 'Sarah (Soft News)',
  'antoni': 'Antoni (Friendly)',
  'thomas': 'Thomas (Calm British)',
  'charlie': 'Charlie (Australian)',
  'george': 'George (British Narrator)',
  'emily': 'Emily (Calm American)',
  'elli': 'Elli (Young Female)',
} as const;

export type DefaultElevenLabsVoice = keyof typeof DEFAULT_ELEVENLABS_VOICE_LABELS;
export type ElevenLabsVoice = DefaultElevenLabsVoice | (string & {});

export const ELEVENLABS_VOICE_LABELS: Record<string, string> = {
  ...DEFAULT_ELEVENLABS_VOICE_LABELS,
};

// Music Generator Node Data
export interface MusicGeneratorNodeData extends Record<string, unknown> {
  name?: string;
  prompt: string;
  duration: MusicDuration;
  instrumental: boolean;
  guidanceScale: number; // 1-15, default 7
  // Output
  outputUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export type MusicGeneratorNode = Node<MusicGeneratorNodeData, 'musicGenerator'>;

// Speech Node Data
export interface SpeechNodeData extends Record<string, unknown> {
  name?: string;
  model?: SpeechModelType;
  mode?: 'single' | 'dialogue';
  text: string;
  voice: ElevenLabsVoice;
  speed: number; // 0.7-1.2
  stability: number; // 0-1
  language?: TadaLanguage;
  referenceTranscript?: string;
  dialogueLines?: Array<{
    id: string;
    text: string;
    voice: ElevenLabsVoice;
  }>;
  // Output
  outputUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export type SpeechNode = Node<SpeechNodeData, 'speech'>;

// Video Audio Node Data
export interface VideoAudioNodeData extends Record<string, unknown> {
  name?: string;
  model?: VideoAudioModelType;
  prompt: string;
  duration: number; // 1-30 seconds
  cfgStrength: number; // 1-10, default 4.5
  negativePrompt?: string;
  syncMode?: SyncLipsyncMode;
  // Output
  outputUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export type VideoAudioNode = Node<VideoAudioNodeData, 'videoAudio'>;

// Audio model capabilities
export interface AudioModelCapabilities {
  label: string;
  category: 'music' | 'speech' | 'video-audio';
  inputType: ModelInputType;
  description: string;
  requiresAudioReference?: boolean;
  requiresVideoInput?: boolean;
  requiresAudioInput?: boolean;
  supportsDialogue?: boolean;
  supportsVoiceSelection?: boolean;
  supportsPrompt?: boolean;
  supportsNegativePrompt?: boolean;
  supportsDuration?: boolean;
  supportsCfgStrength?: boolean;
  supportsSyncMode?: boolean;
}

export const AUDIO_MODEL_CAPABILITIES: Record<AudioModelType, AudioModelCapabilities> = {
  'ace-step': {
    label: 'ACE-Step',
    category: 'music',
    inputType: 'text-only',
    description: 'Music generation (5-240s)',
  },
  'elevenlabs-tts': {
    label: 'ElevenLabs TTS',
    category: 'speech',
    inputType: 'text-only',
    description: 'Text-to-speech (20+ voices)',
    supportsDialogue: true,
    supportsVoiceSelection: true,
    supportsPrompt: true,
  },
  'lux-tts': {
    label: 'Lux TTS',
    category: 'speech',
    inputType: 'text-and-audio',
    description: 'Fast 48kHz voice-cloning TTS from text plus a reference audio clip.',
    requiresAudioReference: true,
    supportsPrompt: true,
  },
  'tada-3b-tts': {
    label: 'Tada 3B',
    category: 'speech',
    inputType: 'text-and-audio',
    description: 'Voice-cloning speech model with text/audio alignment and optional language control.',
    requiresAudioReference: true,
    supportsPrompt: true,
  },
  'mmaudio-v2': {
    label: 'MMAudio V2',
    category: 'video-audio',
    inputType: 'video-and-text',
    description: 'Generate synced audio for a video from a text prompt.',
    requiresVideoInput: true,
    supportsPrompt: true,
    supportsNegativePrompt: true,
    supportsDuration: true,
    supportsCfgStrength: true,
  },
  'sync-lipsync-v2-pro': {
    label: 'Sync Lipsync 2 Pro',
    category: 'video-audio',
    inputType: 'video-and-audio',
    description: 'Lip-sync a face video to a connected audio track.',
    requiresVideoInput: true,
    requiresAudioInput: true,
    supportsSyncMode: true,
  },
} as const;

export const SPEECH_MODEL_CAPABILITIES: Record<SpeechModelType, AudioModelCapabilities> = {
  'elevenlabs-tts': AUDIO_MODEL_CAPABILITIES['elevenlabs-tts'],
  'lux-tts': AUDIO_MODEL_CAPABILITIES['lux-tts'],
  'tada-3b-tts': AUDIO_MODEL_CAPABILITIES['tada-3b-tts'],
} as const;

export const VIDEO_AUDIO_MODEL_CAPABILITIES: Record<VideoAudioModelType, AudioModelCapabilities> = {
  'mmaudio-v2': AUDIO_MODEL_CAPABILITIES['mmaudio-v2'],
  'sync-lipsync-v2-pro': AUDIO_MODEL_CAPABILITIES['sync-lipsync-v2-pro'],
} as const;

// Fal model IDs for audio
export const FAL_AUDIO_MODELS: Record<AudioModelType, string> = {
  'ace-step': 'fal-ai/ace-step/prompt-to-audio',
  'elevenlabs-tts': 'fal-ai/elevenlabs/tts/eleven-v3',
  'lux-tts': 'fal-ai/lux-tts',
  'tada-3b-tts': 'fal-ai/tada/3b/text-to-speech',
  'mmaudio-v2': 'fal-ai/mmaudio/v2',
  'sync-lipsync-v2-pro': 'fal-ai/sync-lipsync/v2/pro',
} as const;

// ============================================
// MODEL CREDIT COSTS (mirrors model-costs.yaml `credits` field — what we charge users)
// ============================================

export const IMAGE_MODEL_CREDITS: Partial<Record<ImageModelType, number>> = {
  'flux-schnell': 1,
  'flux-pro': 2,
  'flux-2-pro': 1,
  'flux-2-max': 3,
  'flux-kontext': 2,
  'nanobanana-pro': 5,
  'nanobanana-2': 3,
  'qwen-image-2': 2,
  'qwen-image-2-pro': 3,
  'grok-imagine-image': 1,
  'grok-imagine-image-edit': 1,
  'recraft-v3': 2,
  'recraft-v4': 2,
  'seedream-5': 2,
  'ideogram-v3': 2,
  'physic-edit': 3,
  'firered-edit': 3,
  'sd-3.5': 2,
};

export const VIDEO_MODEL_CREDITS: Partial<Record<VideoModelType, number>> = {
  'veo-3': 30,
  'veo-3.1-i2v': 30,
  'veo-3.1-fast-i2v': 15,
  'veo-3.1-ref': 30,
  'veo-3.1-flf': 30,
  'veo-3.1-fast-flf': 15,
  'vidu-q3-t2v': 11,
  'vidu-q3-i2v': 11,
  'vidu-q3-t2v-turbo': 6,
  'vidu-q3-i2v-turbo': 6,
  'sora-2-t2v': 30,
  'sora-2-i2v': 30,
  'sora-2-pro-i2v': 45,
  'sora-2-remix-v2v': 30,
  'grok-imagine-t2v': 11,
  'grok-imagine-i2v': 11,
  'grok-imagine-edit-v2v': 12,
  'ltx-2.3-i2v': 9,
  'ltx-2.3-fast-t2v': 6,
  'ltx-2.3-fast-i2v': 6,
  'ltx-2.3-retake-v2v': 9,
  'ltx-2.3-a2v': 9,
  'ltx-2.3-extend': 9,
  'ltx-2-19b-t2v': 7,
  'ltx-2-19b-i2v': 7,
  'ltx-2-19b-v2v': 7,
  'ltx-2-19b-extend': 7,
  'ltx-2-19b-a2v': 7,
  'veed-fabric-1.0': 15,
  'heygen-avatar4-i2v': 15,
  'kling-2.6-t2v': 11,
  'kling-2.6-i2v': 11,
  'kling-o3-t2v': 34,
  'kling-o3-i2v': 26,
  'kling-o3-pro-i2v': 34,
  'kling-3.0-t2v': 26,
  'kling-3.0-i2v': 26,
  'kling-3.0-pro-t2v': 34,
  'kling-3.0-pro-i2v': 34,
  'kling-3.0-mc': 26,
  'kling-3.0-pro-mc': 34,
  'seedance-1.5-t2v': 4,
  'seedance-1.5-i2v': 4,
  'seedance-1.0-pro-t2v': 19,
  'seedance-1.0-pro-i2v': 19,
  'seedance-2.0-t2v': 5,
  'seedance-2.0-i2v': 5,
  'seedance-2.0-fast-t2v': 3,
  'seedance-2.0-fast-i2v': 3,
  'wan-2.6-t2v': 15,
  'wan-2.6-i2v': 15,
  'hailuo-02-t2v': 12,
  'hailuo-02-i2v': 12,
  'hailuo-2.3-t2v': 10,
  'hailuo-2.3-i2v': 10,
  'luma-ray2': 15,
  'minimax-video': 15,
  'runway-gen3': 8,
};
