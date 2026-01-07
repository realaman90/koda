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

// Nano Banana Pro
class NanoBananaAdapter implements ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || '1K',
      num_images: request.numImages || 1,
      output_format: 'png',
      ...(request.referenceUrl && { image_urls: [request.referenceUrl] }),
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
      ...(request.generateAudio !== false && { enable_audio: true }),
    };
  }

  extractVideoUrl(result: Record<string, unknown>): string | undefined {
    const data = result.data as { video?: { url: string } } | undefined;
    return data?.video?.url;
  }
}

// Kling 2.6 Image-to-Video
class KlingI2VAdapter implements VideoModelAdapter {
  buildInput(request: VideoGenerateRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      duration: String(request.duration),
      aspect_ratio: request.aspectRatio,
      ...(request.referenceUrl && { image_url: request.referenceUrl }),
      ...(request.generateAudio !== false && { enable_audio: true }),
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
      resolution: request.resolution || '720p',
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
