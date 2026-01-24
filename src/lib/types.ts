import type { Node, Edge } from '@xyflow/react';

// Node Types
export type NodeType = 'imageGenerator' | 'videoGenerator' | 'text' | 'media' | 'stickyNote' | 'sticker' | 'group' | 'storyboard' | 'musicGenerator' | 'speech' | 'videoAudio';

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
export type ImageModelType = 'flux-schnell' | 'flux-pro' | 'nanobanana-pro' | 'recraft-v3' | 'ideogram-v3' | 'sd-3.5';

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
  type?: 'image' | 'video';
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
}

export type GroupNode = Node<GroupNodeData, 'group'>;

// Union of all node types
export type AppNode = ImageGeneratorNode | VideoGeneratorNode | TextNode | MediaNode | StickyNoteNode | StickerNode | GroupNode | StoryboardNode | MusicGeneratorNode | SpeechNode | VideoAudioNode;
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
  if (model === 'nanobanana-pro') {
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
  'flux-schnell': 'fal-ai/flux/schnell',
  'flux-pro': 'fal-ai/flux-pro',
  'nanobanana-pro': 'fal-ai/nano-banana-pro',
  'recraft-v3': 'fal-ai/recraft-v3',
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
} as const;

// ============================================
// VIDEO GENERATION TYPES
// ============================================

// Video model types
export type VideoModelType =
  | 'veo-3'
  | 'veo-3.1-i2v'
  | 'veo-3.1-fast-i2v'
  | 'veo-3.1-ref'
  | 'veo-3.1-flf'
  | 'veo-3.1-fast-flf'
  | 'kling-2.6-t2v'
  | 'kling-2.6-i2v'
  | 'luma-ray2'
  | 'minimax-video'
  | 'runway-gen3';

// Video duration options (in seconds)
export type VideoDuration = 4 | 5 | 6 | 8 | 9 | 10;

// Video aspect ratios
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

// Video resolution
export type VideoResolution = '540p' | '720p' | '1080p';

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
}

export type VideoGeneratorNode = Node<VideoGeneratorNodeData, 'videoGenerator'>;

// Video input mode - determines what handles to show
export type VideoInputMode = 'text' | 'single-image' | 'first-last-frame' | 'multi-reference';

// Video model capabilities
export interface VideoModelCapabilities {
  label: string;
  inputType: ModelInputType;
  inputMode: VideoInputMode; // Determines which handles to show
  durations: readonly VideoDuration[];
  defaultDuration: VideoDuration; // Default duration for this model
  aspectRatios: readonly VideoAspectRatio[];
  resolutions?: readonly VideoResolution[];
  supportsAudio?: boolean;
  maxReferences?: number; // For multi-reference models (default 1)
  lastFrameOptional?: boolean; // For first-last-frame mode: if true, last frame is optional
  description: string;
}

export const VIDEO_MODEL_CAPABILITIES: Record<VideoModelType, VideoModelCapabilities> = {
  'veo-3': {
    label: 'Veo 3',
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
    label: 'Veo 3.1 Fast First-Last',
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
    inputType: 'text-and-image',
    inputMode: 'first-last-frame',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
    lastFrameOptional: true,
    description: 'Start + optional end frame with audio',
  },
  'luma-ray2': {
    label: 'Luma Ray 2',
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
    inputType: 'text-and-image',
    inputMode: 'single-image',
    durations: [5],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    description: 'Fast generation',
  },
  'runway-gen3': {
    label: 'Runway Gen-3',
    inputType: 'image-only',
    inputMode: 'single-image',
    durations: [5, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16'],
    description: 'Premium image-to-video',
  },
} as const;

// Fal model IDs for video
export const FAL_VIDEO_MODELS: Record<VideoModelType, string> = {
  'veo-3': 'fal-ai/veo3',
  'veo-3.1-i2v': 'fal-ai/veo3.1/image-to-video',
  'veo-3.1-fast-i2v': 'fal-ai/veo3.1/fast/image-to-video',
  'veo-3.1-ref': 'fal-ai/veo3.1/reference-to-video',
  'veo-3.1-flf': 'fal-ai/veo3.1/first-last-frame-to-video',
  'veo-3.1-fast-flf': 'fal-ai/veo3.1/fast/first-last-frame-to-video',
  'kling-2.6-t2v': 'fal-ai/kling-video/v2.6/pro/text-to-video',
  'kling-2.6-i2v': 'fal-ai/kling-video/v2.6/pro/image-to-video',
  'luma-ray2': 'fal-ai/luma-dream-machine',
  'minimax-video': 'fal-ai/minimax-video/image-to-video',
  'runway-gen3': 'fal-ai/runway-gen3/turbo/image-to-video',
} as const;

// ============================================
// STORYBOARD NODE TYPES
// ============================================

// Storyboard mode
export type StoryboardMode = 'transition' | 'single-shot';

// Storyboard visual style
export type StoryboardStyle = 'cinematic' | 'anime' | 'photorealistic' | 'illustrated' | 'commercial';

// Storyboard view state
export type StoryboardViewState = 'form' | 'loading' | 'preview';

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
}

// Storyboard Node Data
export interface StoryboardNodeData extends Record<string, unknown> {
  name?: string;
  // Form fields
  product: string;
  character: string;
  concept: string;
  sceneCount: number;
  style: StoryboardStyle;
  mode: StoryboardMode;  // 'transition' for N-1 videos between frames, 'single-shot' for N independent videos
  // UI state
  viewState: StoryboardViewState;
  error?: string;
  // Generated result (stored for persistence)
  result?: {
    scenes: StoryboardSceneData[];
    summary: string;
  };
}

export type StoryboardNode = Node<StoryboardNodeData, 'storyboard'>;

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
