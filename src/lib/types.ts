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

// Resolution options per model type
export type FluxImageSize = 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';
export type NanoBananaResolution = '1K' | '2K' | '4K';

// Aspect ratio type (union of all supported)
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | '5:4' | '4:5';

// Model input type - determines if model accepts text only, image input, or both
export type ModelInputType = 'text-only' | 'text-and-image' | 'image-only';

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
export type ImageModelType = 'auto' | 'flux-schnell' | 'flux-pro' | 'flux-2-pro' | 'flux-2-max' | 'flux-kontext' | 'nanobanana-pro' | 'nanobanana-2' | 'recraft-v3' | 'recraft-v4' | 'seedream-5' | 'ideogram-v3' | 'sd-3.5';


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
  'recraft-v3',
  'recraft-v4',
  'seedream-5',
  'ideogram-v3',
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
  // Output
  outputUrl?: string;
  outputUrls?: string[]; // Array for multiple outputs
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
  if (model === 'nanobanana-pro' || model === 'nanobanana-2') {
    const baseSize = resolution === '4K' ? 4096 : resolution === '2K' ? 2048 : 1024;
    const [w, h] = aspectRatio.split(':').map(Number);
    const ratio = w / h;
    if (ratio >= 1) {
      return { width: baseSize, height: Math.round(baseSize / ratio) };
    } else {
      return { width: Math.round(baseSize * ratio), height: baseSize };
    }
  }
  // Flux models use preset sizes
  const fluxSize = ASPECT_TO_FLUX_SIZE[aspectRatio] || 'square_hd';
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
  'recraft-v3': 'fal-ai/recraft-v3',
  'recraft-v4': 'fal-ai/recraft/v4/text-to-image',
  'seedream-5': 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
  'ideogram-v3': 'fal-ai/ideogram/v3',
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
  maxImages: number;
  inputType: ModelInputType; // Whether model accepts images
  supportsReferences: boolean;
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
  description: string;
}

export const MODEL_CAPABILITIES: Record<ImageModelType, ModelCapabilities> = {
  'auto': {
    label: 'Auto',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    resolutions: ['1K', '2K', '4K'],
    description: 'Best model for the task',
  },
  'flux-schnell': {
    label: 'Flux Schnell',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'Fast, 1-4 steps',
  },
  'flux-pro': {
    label: 'Flux Pro',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'High quality',
  },
  'nanobanana-pro': {
    label: 'Nano Banana Pro',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 14,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    resolutions: ['1K', '2K', '4K'],
    description: 'Up to 14 style refs',
  },
  'nanobanana-2': {
    label: 'Nano Banana 2',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    maxReferences: 14,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5'],
    resolutions: ['1K', '2K', '4K'],
    description: '4x faster, low cost',
  },
  'recraft-v3': {
    label: 'Recraft V3',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    styles: ['realistic_image', 'digital_illustration', 'vector_illustration'] as const,
    description: 'Versatile styles',
  },
  'ideogram-v3': {
    label: 'Ideogram V3',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    styles: ['auto', 'general', 'realistic', 'design', '3d', 'anime'] as const,
    supportsMagicPrompt: true,
    description: 'Best for text & logos',
  },
  'sd-3.5': {
    label: 'SD 3.5 Large',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    supportsAdvancedParams: true,
    description: 'Open model, img2img',
  },
  'flux-2-pro': {
    label: 'FLUX.2 Pro',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'Next-gen Flux, high quality',
  },
  'flux-2-max': {
    label: 'FLUX.2 Max',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', 'landscape_16_9', 'portrait_16_9'],
    description: 'Max quality Flux',
  },
  'flux-kontext': {
    label: 'Flux Kontext',
    maxImages: 4,
    inputType: 'text-and-image',
    supportsReferences: true,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    description: 'Text + image context editing',
  },
  'seedream-5': {
    label: 'Seedream 5.0',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    description: 'ByteDance image gen',
  },
  'recraft-v4': {
    label: 'Recraft V4',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    styles: ['realistic_image', 'digital_illustration', 'vector_illustration'] as const,
    description: 'Latest Recraft, versatile styles',
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
  | 'kling-2.6-t2v'
  | 'kling-2.6-i2v'
  | 'kling-o3-t2v'
  | 'kling-o3-i2v'
  | 'kling-o3-pro-i2v'
  | 'kling-3.0-t2v'
  | 'kling-3.0-i2v'
  | 'kling-3.0-pro-t2v'
  | 'kling-3.0-pro-i2v'
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
export const AUTO_VIDEO_MODEL: VideoModelType = 'seedance-2.0-fast-t2v';

// Resolve 'auto' to the actual default model
export function resolveAutoModel(model: ImageModelType): ImageModelType {
  return model === 'auto' ? AUTO_IMAGE_MODEL : model;
}
export function resolveAutoVideoModel(model: VideoModelType): VideoModelType {
  return model === 'auto' ? AUTO_VIDEO_MODEL : model;
}

// Video duration options (in seconds)
export type VideoDuration = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 15;

// Video aspect ratios
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

// Video resolution
export type VideoResolution = '480p' | '540p' | '720p' | '1080p';

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
  // Output
  outputUrl?: string;
  thumbnailUrl?: string;
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
  'kling-2.6-t2v',
  'kling-2.6-i2v',
  'kling-o3-t2v',
  'kling-o3-i2v',
  'kling-o3-pro-i2v',
  'kling-3.0-t2v',
  'kling-3.0-i2v',
  'kling-3.0-pro-t2v',
  'kling-3.0-pro-i2v',
  'seedance-1.5-t2v',
  'seedance-1.5-i2v',
  'seedance-1.0-pro-t2v',
  'seedance-1.0-pro-i2v',
  'seedance-2.0-t2v',
  'seedance-2.0-i2v',
  'seedance-2.0-fast-t2v',
  'seedance-2.0-fast-i2v',
  'wan-2.6-t2v',
  'wan-2.6-i2v',
  'hailuo-02-t2v',
  'hailuo-02-i2v',
  'hailuo-2.3-t2v',
  'hailuo-2.3-i2v',
  'luma-ray2',
  'minimax-video',
  'runway-gen3',
];

export const VIDEO_MODEL_CAPABILITIES: Record<VideoModelType, VideoModelCapabilities> = {
  'auto': {
    label: 'Auto',
    group: 'Auto',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    description: 'Best model for the task',
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
    description: 'Best quality text-to-video',
  },
  'veo-3.1-i2v': {
    label: 'Veo 3.1 Image',
    group: 'Google Veo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Animate a single image',
  },
  'veo-3.1-fast-i2v': {
    label: 'Veo 3.1 Fast Image',
    group: 'Google Veo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    description: 'Fast image-to-video',
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
    description: 'Multiple reference images',
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
    description: 'First & last frame to video',
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
    description: 'Fast first & last frame',
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
    description: 'Text-to-video with audio',
  },
  'kling-2.6-i2v': {
    label: 'Kling 2.6 Image',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Start + optional end frame with audio',
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
    description: 'O3 Pro text-to-video',
  },
  'kling-o3-i2v': {
    label: 'Kling O3 Image',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'O3 Standard image-to-video',
  },
  'kling-o3-pro-i2v': {
    label: 'Kling O3 Pro Image',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'O3 Pro image-to-video',
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
    description: '3.0 Standard text-to-video',
  },
  'kling-3.0-i2v': {
    label: 'Kling 3.0 Image',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: '3.0 Standard image-to-video',
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
    description: '3.0 Pro text-to-video',
  },
  'kling-3.0-pro-i2v': {
    label: 'Kling 3.0 Pro Image',
    group: 'Kling',
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: '3.0 Pro image-to-video',
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
    description: 'Latest with audio generation',
  },
  'seedance-1.5-i2v': {
    label: 'Seedance 1.5 Image',
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
    description: 'Image-to-video with audio',
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
    description: '1080p text-to-video',
  },
  'seedance-1.0-pro-i2v': {
    label: 'Seedance 1.0 Pro Image',
    group: 'Seedance',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    promptTools: ['improve', 'translate'],
    description: '1080p image-to-video',
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
    description: 'Best quality, multi-modal',
  },
  'seedance-2.0-i2v': {
    label: 'Seedance 2.0 Image',
    group: 'Seedance 2.0',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    supportsVideoRef: true,
    supportsAudioRef: true,
    promptTools: ['improve', 'translate'],
    description: 'Image + video + audio reference (omni)',
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
    description: 'Faster + cheaper',
  },
  'seedance-2.0-fast-i2v': {
    label: 'Seedance 2.0 Fast Image',
    group: 'Seedance 2.0',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    supportsVideoRef: true,
    supportsAudioRef: true,
    promptTools: ['improve', 'translate'],
    description: 'Fast image + video + audio ref (omni)',
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
    description: 'Cinematic quality',
  },
  'minimax-video': {
    label: 'Minimax',
    group: 'Other',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'Fast generation',
  },
  'runway-gen3': {
    label: 'Runway Gen-3',
    group: 'Other',
    inputType: 'image-only',
    inputMode: 'single-image',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16'],
    description: 'Premium image-to-video',
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
    description: 'High quality text-to-video',
  },
  'wan-2.6-i2v': {
    label: 'Wan 2.6 Image',
    group: 'Wan',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [3, 5, 7, 9],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    description: 'Image-to-video generation',
  },
  'hailuo-02-t2v': {
    label: 'Hailuo 02 Text',
    group: 'Hailuo',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'Hailuo 02 Pro text-to-video',
  },
  'hailuo-02-i2v': {
    label: 'Hailuo 02 Image',
    group: 'Hailuo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'Hailuo 02 Pro image-to-video',
  },
  'hailuo-2.3-t2v': {
    label: 'Hailuo 2.3 Text',
    group: 'Hailuo',
    inputType: 'text-only',
    inputMode: 'text',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'Hailuo 2.3 Fast text-to-video',
  },
  'hailuo-2.3-i2v': {
    label: 'Hailuo 2.3 Image',
    group: 'Hailuo',
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'Hailuo 2.3 Fast image-to-video',
  },
} as const;

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
  'kling-2.6-t2v': 'fal',
  'kling-2.6-i2v': 'fal',
  'kling-o3-t2v': 'fal',
  'kling-o3-i2v': 'fal',
  'kling-o3-pro-i2v': 'fal',
  'kling-3.0-t2v': 'fal',
  'kling-3.0-i2v': 'fal',
  'kling-3.0-pro-t2v': 'fal',
  'kling-3.0-pro-i2v': 'fal',
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
  'kling-2.6-t2v': 'fal-ai/kling-video/v2.6/pro/text-to-video',
  'kling-2.6-i2v': 'fal-ai/kling-video/v2.6/pro/image-to-video',
  'kling-o3-t2v': 'fal-ai/kling-video/o3/pro/text-to-video',
  'kling-o3-i2v': 'fal-ai/kling-video/o3/standard/image-to-video',
  'kling-o3-pro-i2v': 'fal-ai/kling-video/o3/pro/image-to-video',
  'kling-3.0-t2v': 'fal-ai/kling-video/v3/standard/text-to-video',
  'kling-3.0-i2v': 'fal-ai/kling-video/v3/standard/image-to-video',
  'kling-3.0-pro-t2v': 'fal-ai/kling-video/v3/pro/text-to-video',
  'kling-3.0-pro-i2v': 'fal-ai/kling-video/v3/pro/image-to-video',
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
export type AudioModelType = 'ace-step' | 'elevenlabs-tts' | 'mmaudio-v2';

// Music duration options (in seconds)
export type MusicDuration = 5 | 15 | 30 | 60 | 120 | 180 | 240;

// ElevenLabs voice options
export type ElevenLabsVoice =
  | 'alloy'
  | 'echo'
  | 'fable'
  | 'onyx'
  | 'nova'
  | 'shimmer'
  | 'rachel'
  | 'drew'
  | 'clyde'
  | 'paul'
  | 'domi'
  | 'dave'
  | 'fin'
  | 'sarah'
  | 'antoni'
  | 'thomas'
  | 'charlie'
  | 'george'
  | 'emily'
  | 'elli';

export const ELEVENLABS_VOICE_LABELS: Record<ElevenLabsVoice, string> = {
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
  text: string;
  voice: ElevenLabsVoice;
  speed: number; // 0.7-1.2
  stability: number; // 0-1
  // Output
  outputUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export type SpeechNode = Node<SpeechNodeData, 'speech'>;

// Video Audio Node Data
export interface VideoAudioNodeData extends Record<string, unknown> {
  name?: string;
  prompt: string;
  duration: number; // 1-30 seconds
  cfgStrength: number; // 1-10, default 4.5
  negativePrompt?: string;
  // Output
  outputUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export type VideoAudioNode = Node<VideoAudioNodeData, 'videoAudio'>;

// Audio model capabilities
export interface AudioModelCapabilities {
  label: string;
  inputType: ModelInputType;
  description: string;
}

export const AUDIO_MODEL_CAPABILITIES: Record<AudioModelType, AudioModelCapabilities> = {
  'ace-step': {
    label: 'ACE-Step',
    inputType: 'text-only',
    description: 'Music generation (5-240s)',
  },
  'elevenlabs-tts': {
    label: 'ElevenLabs TTS',
    inputType: 'text-only',
    description: 'Text-to-speech (20+ voices)',
  },
  'mmaudio-v2': {
    label: 'MMAudio V2',
    inputType: 'text-and-image',
    description: 'Video-synced audio generation',
  },
} as const;

// Fal model IDs for audio
export const FAL_AUDIO_MODELS: Record<AudioModelType, string> = {
  'ace-step': 'fal-ai/ace-step',
  'elevenlabs-tts': 'fal-ai/elevenlabs/tts/turbo-v2.5',
  'mmaudio-v2': 'fal-ai/mmaudio/v2',
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
  'recraft-v3': 2,
  'recraft-v4': 2,
  'seedream-5': 2,
  'ideogram-v3': 2,
  'sd-3.5': 2,
};

export const VIDEO_MODEL_CREDITS: Partial<Record<VideoModelType, number>> = {
  'veo-3': 30,
  'veo-3.1-i2v': 30,
  'veo-3.1-fast-i2v': 15,
  'veo-3.1-ref': 30,
  'veo-3.1-flf': 30,
  'veo-3.1-fast-flf': 15,
  'kling-2.6-t2v': 11,
  'kling-2.6-i2v': 11,
  'kling-o3-t2v': 34,
  'kling-o3-i2v': 26,
  'kling-o3-pro-i2v': 34,
  'kling-3.0-t2v': 26,
  'kling-3.0-i2v': 26,
  'kling-3.0-pro-t2v': 34,
  'kling-3.0-pro-i2v': 34,
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
