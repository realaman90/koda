import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS, type ElevenLabsVoice } from '@/lib/types';
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
  options: { text: string; model: string; canvasId?: string; nodeId?: string }
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
        prompt: options.text,
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
      text,
      voice,
      speed,
      stability,
    } = body;

    const modelId = FAL_AUDIO_MODELS['elevenlabs-tts'];

    // Validate input
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Build input for ElevenLabs TTS
    const input = {
      text,
      voice: (voice as ElevenLabsVoice) || 'rachel',
      speed: speed || 1.0,
      stability: stability ?? 0.5,
    };

    console.log('Speech generation request:', { modelId, input });

    // Call Fal API
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Speech queue update:', update.status);
      },
    });

    console.log('Speech generation result:', result);

    // Extract audio URL
    const data = result.data as { audio?: { url: string } } | undefined;
    const audioUrl = data?.audio?.url;

    if (!audioUrl) {
      throw new Error('No audio generated');
    }

    // Save audio to configured asset storage
    const { canvasId, nodeId } = body;
    const savedUrl = await saveGeneratedAudio(audioUrl, {
      text,
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
    console.error('Speech generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Speech generation failed' },
      { status: 500 }
    );
  }
}
