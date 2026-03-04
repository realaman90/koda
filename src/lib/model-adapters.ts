import type {
  ImageModelType,
  VideoModelType,
  FluxImageSize,
  NanoBananaResolution,
  RecraftStyle,
  IdeogramStyle,
  AspectRatio,
  VideoAspectRatio,
  VideoDuration,
  VideoResolution,
} from './types';
import {
  ASPECT_TO_FLUX_SIZE,
  DEFAULT_HEYGEN_AVATAR4_VOICE,
  DEFAULT_IMAGE_ASPECT_RATIO,
} from './types';

// Request data passed to the adapter
export interface GenerateRequest {
  prompt: string;
  model: ImageModelType;
  aspectRatio: AspectRatio;
  imageSize?: FluxImageSize;
  resolution?: NanoBananaResolution;
  numImages?: number;
  referenceUrl?: string;
  referenceUrls?: string[]; // For multi-reference models (NanoBanana supports up to 14)
  // Model-specific params
  style?: RecraftStyle | IdeogramStyle;
  magicPrompt?: boolean;
  cfgScale?: number;
  steps?: number;
  strength?: number;
}

// Common interface for all model adapters
export interface ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown>;
  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[];
  // Optional: Get dynamic model ID based on request (for dual-endpoint models like NanoBanana)
  getModelId?(request: GenerateRequest): string;
}

function getConcreteAspectRatio(aspectRatio: AspectRatio): Exclude<AspectRatio, 'auto'> {
  return aspectRatio === 'auto' ? DEFAULT_IMAGE_ASPECT_RATIO : aspectRatio;
}

// Flux models (Schnell and Pro)
class FluxAdapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    const concreteAspectRatio = getConcreteAspectRatio(request.aspectRatio);
    const imageSize = request.imageSize || ASPECT_TO_FLUX_SIZE[concreteAspectRatio] || 'square_hd';

    return {
      prompt: request.prompt,
      image_size: imageSize,
      num_images: request.numImages || 1,
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Nano Banana Pro (supports dual endpoints: text-to-image and image editing)
class NanoBananaAdapter implements ModelAdapter {
  // Determine if we should use the /edit endpoint
  private hasImageReferences(request: GenerateRequest): boolean {
    return (
      (request.referenceUrls && request.referenceUrls.length > 0) ||
      !!request.referenceUrl
    );
  }

  // Get all reference URLs as an array
  private getImageUrls(request: GenerateRequest): string[] {
    if (request.referenceUrls && request.referenceUrls.length > 0) {
      return request.referenceUrls;
    }
    if (request.referenceUrl) {
      return [request.referenceUrl];
    }
    return [];
  }

  // Dynamic model ID based on whether images are provided
  getModelId(request: GenerateRequest): string {
    if (this.hasImageReferences(request)) {
      return 'fal-ai/nano-banana-pro/edit';
    }
    return 'fal-ai/nano-banana-pro';
  }

  buildInput(request: GenerateRequest): Record<string, unknown> {
    const imageUrls = this.getImageUrls(request);
    const isEditMode = imageUrls.length > 0;
    const isAutoAspectRatio = request.aspectRatio === 'auto';

    return {
      prompt: request.prompt,
      // Preserve explicit auto selection; edit mode always uses auto framing.
      aspect_ratio: isEditMode || isAutoAspectRatio ? 'auto' : request.aspectRatio,
      resolution: request.resolution || '1K',
      num_images: request.numImages || 1,
      output_format: 'png',
      // Only include image_urls if we have references (edit mode)
      ...(isEditMode && { image_urls: imageUrls }),
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Nano Banana 2 (same dual-endpoint pattern as Pro: text-to-image + /edit)
class NanoBanana2Adapter implements ModelAdapter {
  private hasImageReferences(request: GenerateRequest): boolean {
    return (
      (request.referenceUrls && request.referenceUrls.length > 0) ||
      !!request.referenceUrl
    );
  }

  private getImageUrls(request: GenerateRequest): string[] {
    if (request.referenceUrls && request.referenceUrls.length > 0) {
      return request.referenceUrls;
    }
    if (request.referenceUrl) {
      return [request.referenceUrl];
    }
    return [];
  }

  getModelId(request: GenerateRequest): string {
    if (this.hasImageReferences(request)) {
      return 'fal-ai/nano-banana-2/edit';
    }
    return 'fal-ai/nano-banana-2';
  }

  buildInput(request: GenerateRequest): Record<string, unknown> {
    const imageUrls = this.getImageUrls(request);
    const isEditMode = imageUrls.length > 0;
    const isAutoAspectRatio = request.aspectRatio === 'auto';

    return {
      prompt: request.prompt,
      aspect_ratio: isEditMode || isAutoAspectRatio ? 'auto' : request.aspectRatio,
      resolution: request.resolution || '1K',
      num_images: request.numImages || 1,
      output_format: 'png',
      ...(isEditMode && { image_urls: imageUrls }),
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Qwen Image 2 (regular/pro, text-to-image + /edit)
class QwenImage2Adapter implements ModelAdapter {
  constructor(private variant: 'regular' | 'pro') {}

  private hasImageReferences(request: GenerateRequest): boolean {
    return (
      (request.referenceUrls && request.referenceUrls.length > 0) ||
      !!request.referenceUrl
    );
  }

  private getImageUrls(request: GenerateRequest): string[] {
    if (request.referenceUrls && request.referenceUrls.length > 0) {
      return request.referenceUrls;
    }
    if (request.referenceUrl) {
      return [request.referenceUrl];
    }
    return [];
  }

  private getBaseModelPath(): string {
    return this.variant === 'pro' ? 'fal-ai/qwen-image-2/pro' : 'fal-ai/qwen-image-2';
  }

  getModelId(request: GenerateRequest): string {
    const base = this.getBaseModelPath();
    if (this.hasImageReferences(request)) {
      return `${base}/edit`;
    }
    return `${base}/text-to-image`;
  }

  buildInput(request: GenerateRequest): Record<string, unknown> {
    const imageUrls = this.getImageUrls(request);
    const hasReferences = imageUrls.length > 0;
    const concreteAspectRatio = getConcreteAspectRatio(request.aspectRatio);
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      num_images: request.numImages || 1,
      output_format: 'png',
      enable_prompt_expansion: true,
      enable_safety_checker: true,
      ...(hasReferences && { image_urls: imageUrls }),
    };

    // In edit mode with auto ratio, preserve input image framing.
    if (!(hasReferences && request.aspectRatio === 'auto')) {
      input.image_size = ASPECT_TO_FLUX_SIZE[concreteAspectRatio] || 'square_hd';
    }

    return input;
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Recraft V3
class RecraftAdapter implements ModelAdapter {
  // Map aspect ratio to Recraft size format
  private getSize(aspectRatio: AspectRatio): { width: number; height: number } {
    const concreteAspectRatio = getConcreteAspectRatio(aspectRatio);
    const sizes: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '4:3': { width: 1365, height: 1024 },
      '3:4': { width: 1024, height: 1365 },
      '16:9': { width: 1820, height: 1024 },
      '9:16': { width: 1024, height: 1820 },
    };
    return sizes[concreteAspectRatio] || sizes['1:1'];
  }

  buildInput(request: GenerateRequest): Record<string, unknown> {
    const size = this.getSize(request.aspectRatio);

    return {
      prompt: request.prompt,
      style: (request.style as RecraftStyle) || 'realistic_image',
      size,
      n: request.numImages || 1,
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Ideogram V3
class IdeogramAdapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    const concreteAspectRatio = getConcreteAspectRatio(request.aspectRatio);
    return {
      prompt: request.prompt,
      aspect_ratio: concreteAspectRatio.replace(':', '_'), // Ideogram uses "1_1" format
      style_type: (request.style as IdeogramStyle) || 'auto',
      magic_prompt_option: request.magicPrompt ? 'ON' : 'OFF',
      num_images: request.numImages || 1,
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Stable Diffusion 3.5 Large
class SD35Adapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    const concreteAspectRatio = getConcreteAspectRatio(request.aspectRatio);
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      num_images: request.numImages || 1,
      guidance_scale: request.cfgScale || 7,
      num_inference_steps: request.steps || 30,
    };

    // Image-to-image mode if reference provided
    if (request.referenceUrl) {
      input.image_url = request.referenceUrl;
      input.strength = request.strength || 0.75;
    } else {
      // Text-to-image: set size based on aspect ratio
      const sizes: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '4:3': { width: 1024, height: 768 },
        '3:4': { width: 768, height: 1024 },
        '16:9': { width: 1024, height: 576 },
        '9:16': { width: 576, height: 1024 },
      };
      const size = sizes[concreteAspectRatio] || sizes['1:1'];
      input.image_size = size;
    }

    return input;
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Seedream 5.0 (ByteDance)
class Seedream5Adapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    const concreteAspectRatio = getConcreteAspectRatio(request.aspectRatio);
    return {
      prompt: request.prompt,
      image_size: request.imageSize || ASPECT_TO_FLUX_SIZE[concreteAspectRatio] || 'square_hd',
      num_images: request.numImages || 1,
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Flux Kontext (text + image context editing)
class FluxKontextAdapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      num_images: request.numImages || 1,
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
    };
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Adapter factory
const adapters: Record<ImageModelType, ModelAdapter> = {
  'auto': new FluxAdapter(), // resolved before adapter lookup
  'flux-schnell': new FluxAdapter(),
  'flux-pro': new FluxAdapter(),
  'flux-2-pro': new FluxAdapter(),
  'flux-2-max': new FluxAdapter(),
  'flux-kontext': new FluxKontextAdapter(),
  'nanobanana-pro': new NanoBananaAdapter(),
  'nanobanana-2': new NanoBanana2Adapter(),
  'qwen-image-2': new QwenImage2Adapter('regular'),
  'qwen-image-2-pro': new QwenImage2Adapter('pro'),
  'recraft-v3': new RecraftAdapter(),
  'recraft-v4': new RecraftAdapter(), // same API shape as V3
  'seedream-5': new Seedream5Adapter(),
  'ideogram-v3': new IdeogramAdapter(),
  'sd-3.5': new SD35Adapter(),
};

export function getModelAdapter(model: ImageModelType): ModelAdapter {
  return adapters[model] || adapters['flux-schnell'];
}

// ============================================
// VIDEO MODEL ADAPTERS
// ============================================

// Request data for video generation
export interface VideoGenerateRequest {
  prompt: string;
  model: VideoModelType;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution?: VideoResolution;
  // Single image reference
  referenceUrl?: string;
  // First/last frame mode
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  // Multi-reference mode
  referenceUrls?: string[];
  // Video reference (for omni-reference models like Seedance 2.0)
  videoUrl?: string;
  // Reusable provider-native video ID (required by some remix endpoints)
  videoId?: string;
  // Audio reference (for Seedance 2.0 omni-reference)
  audioUrl?: string;
  generateAudio?: boolean;
  // Heygen Avatar 4 specific
  heygenVoice?: string;
}

// Common interface for video adapters
export interface VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown>;
  extractVideoUrl(result: Record<string, unknown>): string | undefined;
  extractVideoId?(result: Record<string, unknown>): string | undefined;
}

// Google Veo 3
class Veo3Adapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      duration: `${request.duration}s`,
      resolution: request.resolution || '720p',
      generate_audio: request.generateAudio ?? true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Veo 3.1 Image-to-Video
class Veo31I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.referenceUrl) {
      throw new Error('Veo 3.1 I2V requires a reference image');
    }
    return {
      prompt: request.prompt,
      image_url: request.referenceUrl,
      aspect_ratio: request.aspectRatio,
      duration: `${request.duration}s`,
      resolution: request.resolution || '720p',
      generate_audio: request.generateAudio ?? true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Veo 3.1 Reference-to-Video (uses multiple reference images for consistent subject)
class Veo31RefAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    // Use referenceUrls array if available, otherwise fall back to single referenceUrl
    const imageUrls = request.referenceUrls?.length
      ? request.referenceUrls
      : request.referenceUrl
        ? [request.referenceUrl]
        : [];

    if (imageUrls.length === 0) {
      throw new Error('Veo 3.1 Multi-Ref requires at least one reference image');
    }
    return {
      prompt: request.prompt,
      image_urls: imageUrls,
      aspect_ratio: request.aspectRatio,
      duration: `${request.duration}s`,
      resolution: request.resolution || '720p',
      generate_audio: request.generateAudio ?? true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Veo 3.1 First-Last-Frame-to-Video
class Veo31FLFAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const firstFrame = request.firstFrameUrl || request.referenceUrl;
    const lastFrame = request.lastFrameUrl || request.referenceUrl;

    if (!firstFrame || !lastFrame) {
      throw new Error('Veo 3.1 First-Last requires first and last frame images');
    }
    return {
      prompt: request.prompt,
      first_frame_url: firstFrame,
      last_frame_url: lastFrame,
      aspect_ratio: request.aspectRatio,
      duration: `${request.duration}s`,
      resolution: request.resolution || '720p',
      generate_audio: request.generateAudio ?? true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Vidu Q3 Text-to-Video
class ViduT2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: request.duration,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || '720p',
      audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Vidu Q3 Image-to-Video
class ViduI2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const startImage = request.firstFrameUrl || request.referenceUrl;
    const endImage = request.lastFrameUrl;
    if (!startImage) {
      throw new Error('Vidu Q3 image model requires a reference image');
    }
    return {
      prompt: request.prompt,
      image_url: startImage,
      ...(endImage && { end_image_url: endImage }),
      duration: request.duration,
      resolution: request.resolution || '720p',
      audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// OpenAI Sora 2 Text-to-Video
class Sora2T2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: request.duration,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || '720p',
      enable_safety_checker: true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }

  extractVideoId(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video_id?: string } | undefined;
    return data?.video_id;
  }
}

// OpenAI Sora 2 Image-to-Video
class Sora2I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const imageUrl = request.firstFrameUrl || request.referenceUrl;
    if (!imageUrl) {
      throw new Error('Sora 2 image model requires a reference image');
    }
    return {
      prompt: request.prompt,
      image_url: imageUrl,
      duration: request.duration,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || '720p',
      enable_safety_checker: true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }

  extractVideoId(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video_id?: string } | undefined;
    return data?.video_id;
  }
}

// Sora 2 Remix (requires provider-native video_id from a previous Sora output)
class Sora2RemixAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.videoId) {
      throw new Error('Sora 2 remix requires a connected Sora video output (video_id)');
    }
    if (!request.prompt?.trim()) {
      throw new Error('Sora 2 remix requires a prompt');
    }
    return {
      video_id: request.videoId,
      prompt: request.prompt,
      delete_video: true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }

  extractVideoId(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video_id?: string } | undefined;
    return data?.video_id;
  }
}

// xAI Grok Text-to-Video
class GrokT2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: request.duration,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || '720p',
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// xAI Grok Image-to-Video
class GrokI2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const imageUrl = request.firstFrameUrl || request.referenceUrl;
    if (!imageUrl) {
      throw new Error('Grok image-to-video requires a reference image');
    }
    return {
      prompt: request.prompt,
      image_url: imageUrl,
      duration: request.duration,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || '720p',
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// xAI Grok Edit-Video
class GrokEditVideoAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.videoUrl) {
      throw new Error('Grok edit-video requires a video input');
    }
    return {
      prompt: request.prompt,
      video_url: request.videoUrl,
      resolution: request.resolution || '720p',
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

function toLtxVideoSize(aspectRatio: VideoAspectRatio): string {
  const map: Record<VideoAspectRatio, string> = {
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '1:1': 'square_hd',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
  };
  return map[aspectRatio] || 'landscape_4_3';
}

function toLtxNumFrames(duration: VideoDuration): number {
  // LTX is frame-based; this keeps duration roughly aligned with UI seconds.
  return Math.max(25, duration * 25 + 1);
}

// LTX 2 19B Text-to-Video
class LtxT2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      video_size: toLtxVideoSize(request.aspectRatio),
      num_frames: toLtxNumFrames(request.duration),
      generate_audio: request.generateAudio !== false,
      fps: 25,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// LTX 2 19B Image-to-Video
class LtxI2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const imageUrl = request.firstFrameUrl || request.referenceUrl;
    if (!imageUrl) {
      throw new Error('LTX image-to-video requires a reference image');
    }
    return {
      prompt: request.prompt,
      image_url: imageUrl,
      ...(request.lastFrameUrl && { end_image_url: request.lastFrameUrl }),
      video_size: toLtxVideoSize(request.aspectRatio),
      num_frames: toLtxNumFrames(request.duration),
      generate_audio: request.generateAudio !== false,
      fps: 25,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// LTX 2 19B Video-to-Video
class LtxV2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.videoUrl) {
      throw new Error('LTX video-to-video requires a video input');
    }
    const imageUrl = request.referenceUrls?.[0] || request.referenceUrl || request.firstFrameUrl;
    return {
      prompt: request.prompt,
      video_url: request.videoUrl,
      ...(request.audioUrl && { audio_url: request.audioUrl }),
      ...(imageUrl && { image_url: imageUrl }),
      ...(request.lastFrameUrl && { end_image_url: request.lastFrameUrl }),
      video_size: toLtxVideoSize(request.aspectRatio),
      num_frames: toLtxNumFrames(request.duration),
      generate_audio: request.generateAudio !== false,
      fps: 25,
      match_video_length: false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// LTX 2 19B Extend Video
class LtxExtendAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.videoUrl) {
      throw new Error('LTX extend-video requires a video input');
    }
    return {
      prompt: request.prompt,
      video_url: request.videoUrl,
      ...(request.lastFrameUrl && { end_image_url: request.lastFrameUrl }),
      video_size: toLtxVideoSize(request.aspectRatio),
      num_frames: toLtxNumFrames(request.duration),
      generate_audio: request.generateAudio !== false,
      fps: 25,
      extend_direction: 'forward',
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// LTX 2 19B Audio-to-Video
class LtxA2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.audioUrl) {
      throw new Error('LTX audio-to-video requires an audio input');
    }
    const imageUrl = request.referenceUrls?.[0] || request.referenceUrl || request.firstFrameUrl;
    return {
      prompt: request.prompt,
      audio_url: request.audioUrl,
      ...(imageUrl && { image_url: imageUrl }),
      ...(request.lastFrameUrl && { end_image_url: request.lastFrameUrl }),
      video_size: toLtxVideoSize(request.aspectRatio),
      num_frames: toLtxNumFrames(request.duration),
      fps: 25,
      match_audio_length: false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Veed Fabric 1.0 (requires image + audio)
class VeedFabricAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const imageUrl = request.referenceUrls?.[0] || request.referenceUrl || request.firstFrameUrl;
    if (!imageUrl) {
      throw new Error('Veed Fabric requires an image input');
    }
    if (!request.audioUrl) {
      throw new Error('Veed Fabric requires an audio input');
    }
    return {
      image_url: imageUrl,
      audio_url: request.audioUrl,
      resolution: request.resolution || '720p',
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Heygen Avatar 4
class HeygenAvatar4Adapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const imageUrl = request.firstFrameUrl || request.referenceUrl;
    if (!imageUrl) {
      throw new Error('Heygen Avatar 4 requires an image input');
    }
    if (!request.prompt?.trim()) {
      throw new Error('Heygen Avatar 4 requires a script prompt');
    }
    return {
      image_url: imageUrl,
      prompt: request.prompt,
      voice: request.heygenVoice || DEFAULT_HEYGEN_AVATAR4_VOICE,
      talking_style: 'stable',
      resolution: request.resolution || '720p',
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Kling 2.6 Text-to-Video
class KlingT2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: String(request.duration),
      aspect_ratio: request.aspectRatio,
      generate_audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Kling 2.6 Image-to-Video (supports start image + optional end image)
class KlingI2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    // Use firstFrameUrl if available, otherwise fall back to referenceUrl
    const startImage = request.firstFrameUrl || request.referenceUrl;
    const endImage = request.lastFrameUrl;

    return {
      prompt: request.prompt,
      duration: String(request.duration),
      ...(startImage && { start_image_url: startImage }),
      ...(endImage && { end_image_url: endImage }),
      generate_audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Kling O3 Text-to-Video (Pro)
class KlingO3T2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: String(request.duration),
      aspect_ratio: request.aspectRatio,
      generate_audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Kling O3 Image-to-Video (Standard & Pro - same API shape)
class KlingO3I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const startImage = request.firstFrameUrl || request.referenceUrl;
    const endImage = request.lastFrameUrl;

    return {
      prompt: request.prompt,
      duration: String(request.duration),
      aspect_ratio: request.aspectRatio,
      ...(startImage && { image_url: startImage }),
      ...(endImage && { end_image_url: endImage }),
      generate_audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Kling 3.0 Image-to-Video (uses start_image_url like 2.6, but also supports aspect_ratio)
class Kling3I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const startImage = request.firstFrameUrl || request.referenceUrl;
    const endImage = request.lastFrameUrl;

    return {
      prompt: request.prompt,
      duration: String(request.duration),
      aspect_ratio: request.aspectRatio,
      ...(startImage && { start_image_url: startImage }),
      ...(endImage && { end_image_url: endImage }),
      generate_audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Seedance 1.5 Text-to-Video (supports audio)
class Seedance15T2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      ...(request.resolution && { resolution: request.resolution }),
      duration: String(request.duration),
      generate_audio: request.generateAudio ?? true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Seedance 1.5 Image-to-Video (supports audio + optional end frame)
class Seedance15I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const startImage = request.firstFrameUrl || request.referenceUrl;
    const endImage = request.lastFrameUrl;

    return {
      prompt: request.prompt,
      ...(startImage && { image_url: startImage }),
      ...(endImage && { end_image_url: endImage }),
      aspect_ratio: request.aspectRatio,
      ...(request.resolution && { resolution: request.resolution }),
      duration: String(request.duration),
      generate_audio: request.generateAudio ?? true,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Seedance 1.0 Pro Text-to-Video (no audio)
class Seedance10T2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      ...(request.resolution && { resolution: request.resolution }),
      duration: String(request.duration),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Seedance 1.0 Pro Image-to-Video (no audio, single image)
class Seedance10I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    const imageUrl = request.firstFrameUrl || request.referenceUrl;

    return {
      prompt: request.prompt,
      ...(imageUrl && { image_url: imageUrl }),
      aspect_ratio: request.aspectRatio,
      ...(request.resolution && { resolution: request.resolution }),
      duration: String(request.duration),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Seedance 2.0 Text-to-Video (xskill.ai)
// buildInput returns the xskill `params` block (not Fal input)
class Seedance2T2VAdapter implements VideoModelAdapter {
  constructor(private innerModel: 'seedance_2.0' | 'seedance_2.0_fast') {}

  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      model: this.innerModel,
      prompt: request.prompt,
      functionMode: 'first_last_frames',
      ratio: request.aspectRatio,
      duration: request.duration,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    // xskill response: { data: { result: { output: { images: [url] } } } }
    const data = result.data as { result?: { output?: { images?: string[] } } } | undefined;
    return data?.result?.output?.images?.[0];
  }
}

/**
 * Translate user-friendly shorthand to X-Skill Seedance API format.
 * @image1 → @image_file_1, @video1 → @video_file_1, @audio1 → @audio_file_1, etc.
 */
function transformSeedancePromptRefs(prompt: string): string {
  return prompt
    .replace(/@image(\d+)/gi, (_, n) => `@image_file_${n}`)
    .replace(/@video(\d+)/gi, (_, n) => `@video_file_${n}`)
    .replace(/@audio(\d+)/gi, (_, n) => `@audio_file_${n}`);
}

/**
 * first_last_frames mode doesn't use explicit @*_file_* references.
 * Strip/normalize mention tokens to avoid provider-side parameter validation errors.
 */
function normalizeSeedanceFirstLastPrompt(prompt: string): string {
  return prompt
    .replace(/@image_file_\d+/gi, 'reference image')
    .replace(/@image\d+/gi, 'reference image')
    .replace(/@video_file_\d+/gi, '')
    .replace(/@video\d+/gi, '')
    .replace(/@audio_file_\d+/gi, '')
    .replace(/@audio\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Seedance 2.0 Image-to-Video (xskill.ai)
// Supports omni_reference mode when both image and video are provided
class Seedance2I2VAdapter implements VideoModelAdapter {
  constructor(private innerModel: 'seedance_2.0' | 'seedance_2.0_fast') {}

  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    // Collect all image URLs from multi-ref handles, falling back to single ref
    const imageUrls: string[] = [];
    if (request.referenceUrls?.length) {
      imageUrls.push(...request.referenceUrls);
    } else {
      const singleUrl = request.firstFrameUrl || request.referenceUrl;
      if (singleUrl) imageUrls.push(singleUrl);
    }

    const videoUrl = request.videoUrl;
    const omniPrompt = transformSeedancePromptRefs(request.prompt);

    // If both images and video are provided, use omni_reference mode
    if (imageUrls.length > 0 && videoUrl) {
      return {
        model: this.innerModel,
        prompt: omniPrompt,
        functionMode: 'omni_reference',
        image_files: imageUrls,
        video_files: [videoUrl],
        ...(request.audioUrl && { audio_files: [request.audioUrl] }),
        ratio: request.aspectRatio,
        duration: request.duration,
      };
    }

    const firstLastPrompt = normalizeSeedanceFirstLastPrompt(request.prompt);
    // Image-only: use legacy-compatible media_files shape.
    // Some xskill channels/accounts reject first_last_frames+filePaths with 1000.
    return {
      model: this.innerModel,
      prompt: firstLastPrompt,
      ...(imageUrls.length > 0 && { media_files: imageUrls }),
      aspect_ratio: request.aspectRatio,
      duration: String(request.duration),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { result?: { output?: { images?: string[] } } } | undefined;
    return data?.result?.output?.images?.[0];
  }
}

// Luma Ray 2
class LumaRay2Adapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      // Luma accepts duration as number or string like "5s"
      loop: false,
      ...(request.duration && { duration: `${request.duration}s` }),
      ...(request.resolution && { resolution: request.resolution }),
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Minimax Video
class MinimaxVideoAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Runway Gen-3
class RunwayGen3Adapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    if (!request.referenceUrl) {
      throw new Error('Runway Gen-3 requires a reference image');
    }
    return {
      prompt: request.prompt,
      image_url: request.referenceUrl,
      duration: String(request.duration),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Wan 2.6 Text-to-Video
class Wan26T2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      ...(request.resolution && { resolution: request.resolution }),
      duration: String(request.duration),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Wan 2.6 Image-to-Video
class Wan26I2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
      aspect_ratio: request.aspectRatio,
      ...(request.resolution && { resolution: request.resolution }),
      duration: String(request.duration),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Hailuo (Minimax) Text-to-Video
class HailuoT2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Hailuo (Minimax) Image-to-Video
class HailuoI2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Video adapter factory
const videoAdapters: Record<VideoModelType, VideoModelAdapter> = {
  'auto': new Veo3Adapter(), // resolved before adapter lookup
  'veo-3': new Veo3Adapter(),
  'veo-3.1-i2v': new Veo31I2VAdapter(),
  'veo-3.1-fast-i2v': new Veo31I2VAdapter(), // Uses same adapter as regular I2V
  'veo-3.1-ref': new Veo31RefAdapter(),
  'veo-3.1-flf': new Veo31FLFAdapter(),
  'veo-3.1-fast-flf': new Veo31FLFAdapter(), // Uses same adapter as regular FLF
  'vidu-q3-t2v': new ViduT2VAdapter(),
  'vidu-q3-i2v': new ViduI2VAdapter(),
  'vidu-q3-t2v-turbo': new ViduT2VAdapter(),
  'vidu-q3-i2v-turbo': new ViduI2VAdapter(),
  'sora-2-t2v': new Sora2T2VAdapter(),
  'sora-2-i2v': new Sora2I2VAdapter(),
  'sora-2-pro-i2v': new Sora2I2VAdapter(),
  'sora-2-remix-v2v': new Sora2RemixAdapter(),
  'grok-imagine-t2v': new GrokT2VAdapter(),
  'grok-imagine-i2v': new GrokI2VAdapter(),
  'grok-imagine-edit-v2v': new GrokEditVideoAdapter(),
  'ltx-2-19b-t2v': new LtxT2VAdapter(),
  'ltx-2-19b-i2v': new LtxI2VAdapter(),
  'ltx-2-19b-v2v': new LtxV2VAdapter(),
  'ltx-2-19b-extend': new LtxExtendAdapter(),
  'ltx-2-19b-a2v': new LtxA2VAdapter(),
  'veed-fabric-1.0': new VeedFabricAdapter(),
  'heygen-avatar4-i2v': new HeygenAvatar4Adapter(),
  'kling-2.6-t2v': new KlingT2VAdapter(),
  'kling-2.6-i2v': new KlingI2VAdapter(),
  'kling-o3-t2v': new KlingO3T2VAdapter(),
  'kling-o3-i2v': new KlingO3I2VAdapter(),
  'kling-o3-pro-i2v': new KlingO3I2VAdapter(),
  'kling-3.0-t2v': new KlingO3T2VAdapter(),       // Same API shape as O3
  'kling-3.0-i2v': new Kling3I2VAdapter(),           // Uses start_image_url (not image_url like O3)
  'kling-3.0-pro-t2v': new KlingO3T2VAdapter(),    // Same API shape as O3
  'kling-3.0-pro-i2v': new Kling3I2VAdapter(),     // Uses start_image_url (not image_url like O3)
  'seedance-1.5-t2v': new Seedance15T2VAdapter(),
  'seedance-1.5-i2v': new Seedance15I2VAdapter(),
  'seedance-1.0-pro-t2v': new Seedance10T2VAdapter(),
  'seedance-1.0-pro-i2v': new Seedance10I2VAdapter(),
  'seedance-2.0-t2v': new Seedance2T2VAdapter('seedance_2.0'),
  'seedance-2.0-i2v': new Seedance2I2VAdapter('seedance_2.0'),
  'seedance-2.0-fast-t2v': new Seedance2T2VAdapter('seedance_2.0_fast'),
  'seedance-2.0-fast-i2v': new Seedance2I2VAdapter('seedance_2.0_fast'),
  'wan-2.6-t2v': new Wan26T2VAdapter(),
  'wan-2.6-i2v': new Wan26I2VAdapter(),
  'hailuo-02-t2v': new HailuoT2VAdapter(),
  'hailuo-02-i2v': new HailuoI2VAdapter(),
  'hailuo-2.3-t2v': new HailuoT2VAdapter(), // same API shape
  'hailuo-2.3-i2v': new HailuoI2VAdapter(), // same API shape
  'luma-ray2': new LumaRay2Adapter(),
  'minimax-video': new MinimaxVideoAdapter(),
  'runway-gen3': new RunwayGen3Adapter(),
};

export function getVideoModelAdapter(model: VideoModelType): VideoModelAdapter {
  return videoAdapters[model] || videoAdapters['veo-3'];
}

// ============================================
// AUDIO MODEL ADAPTERS
// ============================================

import type {
  AudioModelType,
  MusicDuration,
  ElevenLabsVoice,
} from './types';

// Request data for music generation
export interface MusicGenerateRequest {
  prompt: string;
  duration: MusicDuration;
  instrumental: boolean;
  guidanceScale: number;
}

// Request data for speech generation
export interface SpeechGenerateRequest {
  text: string;
  voice: ElevenLabsVoice;
  speed: number;
  stability: number;
}

// Request data for video audio generation
export interface VideoAudioGenerateRequest {
  prompt: string;
  videoUrl: string;
  duration: number;
  cfgStrength: number;
  negativePrompt?: string;
}

// Common interface for audio adapters
export interface AudioModelAdapter {
  buildInput(request: MusicGenerateRequest | SpeechGenerateRequest | VideoAudioGenerateRequest): Record<string, unknown>;
  extractAudioUrl(result: Record<string, unknown>): string | undefined;
}

// ACE-Step Music Adapter
class AceStepAdapter implements AudioModelAdapter {
  buildInput(request: MusicGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: request.duration,
      instrumental: request.instrumental,
      guidance_scale: request.guidanceScale,
    };
  }

  extractAudioUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { audio?: { url: string } } | undefined;
    return data?.audio?.url;
  }
}

// ElevenLabs TTS Adapter
class ElevenLabsTTSAdapter implements AudioModelAdapter {
  buildInput(request: SpeechGenerateRequest): Record<string, unknown> {
    return {
      text: request.text,
      voice: request.voice,
      speed: request.speed,
      stability: request.stability,
    };
  }

  extractAudioUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { audio?: { url: string } } | undefined;
    return data?.audio?.url;
  }
}

// MMAudio V2 Adapter (Video Audio Sync)
class MMAudioV2Adapter implements AudioModelAdapter {
  buildInput(request: VideoAudioGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      video_url: request.videoUrl,
      duration: request.duration,
      cfg_strength: request.cfgStrength,
      ...(request.negativePrompt && { negative_prompt: request.negativePrompt }),
    };
  }

  extractAudioUrl(result: Record<string, unknown>): string | undefined {
    // MMAudio returns a video with audio, not just audio
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Audio adapter factory
const audioAdapters: Record<AudioModelType, AudioModelAdapter> = {
  'ace-step': new AceStepAdapter(),
  'elevenlabs-tts': new ElevenLabsTTSAdapter(),
  'mmaudio-v2': new MMAudioV2Adapter(),
};

export function getAudioModelAdapter(model: AudioModelType): AudioModelAdapter {
  return audioAdapters[model] || audioAdapters['ace-step'];
}
