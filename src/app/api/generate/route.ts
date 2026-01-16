import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_MODELS, type ImageModelType } from '@/lib/types';
import { getModelAdapter, type GenerateRequest } from '@/lib/model-adapters';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      model,
      aspectRatio,
      imageSize,
      resolution,
      imageCount = 1,
      referenceUrl,
      referenceUrls, // Multi-reference support (up to 14 for NanoBanana)
      // New model-specific params
      style,
      magicPrompt,
      cfgScale,
      steps,
      strength,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const modelType = model as ImageModelType;

    // Clamp imageCount to 1-4
    const numImages = Math.max(1, Math.min(4, imageCount));

    // Build request for adapter
    const generateRequest: GenerateRequest = {
      prompt,
      model: modelType,
      aspectRatio,
      imageSize,
      resolution,
      numImages,
      referenceUrl,
      referenceUrls, // Pass multi-reference array
      style,
      magicPrompt,
      cfgScale,
      steps,
      strength,
    };

    // Get adapter and build input
    const adapter = getModelAdapter(modelType);
    const input = adapter.buildInput(generateRequest);

    // Get model ID - use adapter's dynamic ID if available (for dual-endpoint models like NanoBanana)
    const modelId = adapter.getModelId
      ? adapter.getModelId(generateRequest)
      : FAL_MODELS[modelType] || FAL_MODELS['flux-schnell'];

    // Call Fal API
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Queue update:', update.status);
      },
    });

    // Extract image URLs using adapter
    const imageUrls = adapter.extractImageUrls(result as { data?: { images?: Array<{ url: string }> } });

    if (imageUrls.length === 0) {
      throw new Error('No images generated');
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrls[0], // For backwards compatibility
      imageUrls, // Array of all generated images
      model: modelId,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
