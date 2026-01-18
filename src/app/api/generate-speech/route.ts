import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS, type ElevenLabsVoice } from '@/lib/types';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

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

    return NextResponse.json({
      success: true,
      audioUrl,
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
