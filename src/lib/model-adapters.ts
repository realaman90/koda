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
import { ASPECT_TO_FLUX_SIZE } from './types';

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

// Flux models (Schnell and Pro)
class FluxAdapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    const imageSize = request.imageSize || ASPECT_TO_FLUX_SIZE[request.aspectRatio] || 'square_hd';

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

    return {
      prompt: request.prompt,
      // For edit mode, use 'auto' aspect ratio; for text-to-image, use specified
      aspect_ratio: isEditMode ? 'auto' : request.aspectRatio,
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

// Recraft V3
class RecraftAdapter implements ModelAdapter {
  // Map aspect ratio to Recraft size format
  private getSize(aspectRatio: AspectRatio): { width: number; height: number } {
    const sizes: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '4:3': { width: 1365, height: 1024 },
      '3:4': { width: 1024, height: 1365 },
      '16:9': { width: 1820, height: 1024 },
      '9:16': { width: 1024, height: 1820 },
    };
    return sizes[aspectRatio] || sizes['1:1'];
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
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio.replace(':', '_'), // Ideogram uses "1_1" format
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
      const size = sizes[request.aspectRatio] || sizes['1:1'];
      input.image_size = size;
    }

    return input;
  }

  extractImageUrls(result: { data?: { images?: Array<{ url: string }> } }): string[] {
    return result.data?.images?.map((img) => img.url) || [];
  }
}

// Adapter factory
const adapters: Record<ImageModelType, ModelAdapter> = {
  'flux-schnell': new FluxAdapter(),
  'flux-pro': new FluxAdapter(),
  'nanobanana-pro': new NanoBananaAdapter(),
  'recraft-v3': new RecraftAdapter(),
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
  generateAudio?: boolean;
}

// Common interface for video adapters
export interface VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown>;
  extractVideoUrl(result: Record<string, unknown>): string | undefined;
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

// Kling 2.6 Text-to-Video
class KlingT2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: String(request.duration),
      aspect_ratio: request.aspectRatio,
      enable_audio: request.generateAudio !== false,
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
      aspect_ratio: request.aspectRatio,
      ...(startImage && { image_url: startImage }),
      ...(endImage && { tail_image_url: endImage }),
      enable_audio: request.generateAudio !== false,
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
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

// Video adapter factory
const videoAdapters: Record<VideoModelType, VideoModelAdapter> = {
  'veo-3': new Veo3Adapter(),
  'veo-3.1-i2v': new Veo31I2VAdapter(),
  'veo-3.1-fast-i2v': new Veo31I2VAdapter(), // Uses same adapter as regular I2V
  'veo-3.1-ref': new Veo31RefAdapter(),
  'veo-3.1-flf': new Veo31FLFAdapter(),
  'veo-3.1-fast-flf': new Veo31FLFAdapter(), // Uses same adapter as regular FLF
  'kling-2.6-t2v': new KlingT2VAdapter(),
  'kling-2.6-i2v': new KlingI2VAdapter(),
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
