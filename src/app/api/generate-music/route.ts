import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS } from '@/lib/types';
import type { MusicGenerateRequest } from '@/lib/model-adapters';
import { getAssetStorageType, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';

export const maxDuration = 300;

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

/**
 * Get the asset storage provider (server-side only)
 */
async function getProvider(): Promise<AssetStorageProvider> {
  const storageType = getAssetStorageType();
  
  if (storageType === 'r2' || storageType === 's3') {
    const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
    return getS3AssetProvider(storageType);
  }
  
  const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
  return getLocalAssetProvider();
}

/**
 * Save generated audio to configured asset storage
 */
async function saveGeneratedAudio(
  url: string,
  options: { prompt: string; model: string; canvasId?: string; nodeId?: string }
): Promise<string> {
  const storageType = getAssetStorageType();
  
  if (storageType === 'local' && !process.env.ASSET_STORAGE) {
    return url;
  }

  const provider = await getProvider();

  try {
    const extension = getExtensionFromUrl(url) || 'mp3';
    const asset = await provider.saveFromUrl(url, {
      type: 'audio',
      extension,
      metadata: {
        mimeType: `audio/${extension === 'mp3' ? 'mpeg' : extension}`,
        prompt: options.prompt,
        model: options.model,
        canvasId: options.canvasId,
        nodeId: options.nodeId,
      },
    });
    return asset.url;
  } catch (error) {
    console.error('Failed to save audio asset:', error);
    return url;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      duration,
      instrumental,
      guidanceScale,
    } = body;

    const modelId = FAL_AUDIO_MODELS['ace-step'];

    // Validate input
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Build request
    const generateRequest: MusicGenerateRequest = {
      prompt,
      duration: duration || 30,
      instrumental: instrumental ?? false,
      guidanceScale: guidanceScale || 7,
    };

    // Build input for ACE-Step
    const input = {
      prompt: generateRequest.prompt,
      duration: generateRequest.duration,
      instrumental: generateRequest.instrumental,
      guidance_scale: generateRequest.guidanceScale,
    };

    console.log('Music generation request:', { modelId, input });

    // Call Fal API with queue subscription for long-running generation
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Music queue update:', update.status);
      },
    });

    console.log('Music generation result:', result);

    // Extract audio URL
    const data = result.data as { audio?: { url: string } } | undefined;
    const audioUrl = data?.audio?.url;

    if (!audioUrl) {
      throw new Error('No audio generated');
    }

    // Save audio to configured asset storage
    const { canvasId, nodeId } = body;
    const savedUrl = await saveGeneratedAudio(audioUrl, {
      prompt,
      model: modelId,
      canvasId,
      nodeId,
    });

    return NextResponse.json({
      success: true,
      audioUrl: savedUrl,
      originalUrl: audioUrl,
      model: modelId,
    });
  } catch (error) {
    console.error('Music generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Music generation failed' },
      { status: 500 }
    );
  }
}
