import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS, type VideoAudioModelType } from '@/lib/types';
import { withCredits } from '@/lib/credits/with-credits';

export const maxDuration = 300;

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

function normalizeVideoAudioModel(value: unknown): VideoAudioModelType {
  return value === 'sync-lipsync-v2-pro' ? value : 'mmaudio-v2';
}

export const POST = withCredits(
  {
    type: 'audio',
    getCostParams: (body) => ({ model: normalizeVideoAudioModel(body.model) }),
  },
  async (request) => {
    try {
      const body = await request.json();
      const {
        model,
        prompt,
        videoUrl,
        audioUrl,
        duration,
        cfgStrength,
        negativePrompt,
        syncMode,
      } = body;

      const selectedModel = normalizeVideoAudioModel(model);
      const modelId = FAL_AUDIO_MODELS[selectedModel];

      // Validate input
      if (!videoUrl) {
        return NextResponse.json(
          { error: 'Video URL is required' },
          { status: 400 }
        );
      }

      const input: Record<string, unknown> = {
        video_url: videoUrl,
      };

      if (selectedModel === 'sync-lipsync-v2-pro') {
        if (!audioUrl) {
          return NextResponse.json(
            { error: 'Audio URL is required for Sync Lipsync' },
            { status: 400 }
          );
        }

        input.audio_url = audioUrl;
        input.sync_mode = syncMode || 'cut_off';
      } else {
        input.prompt = prompt || '';
        input.duration = duration || 10;
        input.cfg_strength = cfgStrength || 4.5;

        if (negativePrompt) {
          input.negative_prompt = negativePrompt;
        }
      }

      console.log('Video audio generation request:', { selectedModel, modelId, input });

      // Call Fal API with queue subscription
      const result = await fal.subscribe(modelId, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          console.log('Video audio queue update:', update.status);
        },
      });

      console.log('Video audio generation result:', result);

      // MMAudio returns a video with synced audio
      const data = result.data as { video?: { url: string } } | undefined;
      const outputUrl = data?.video?.url;

      if (!outputUrl) {
        throw new Error('No output generated');
      }

      return NextResponse.json({
        success: true,
        videoUrl: outputUrl,
        selectedModel,
        model: modelId,
      });
    } catch (error) {
      console.error('Video audio generation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Video audio generation failed' },
        { status: 500 }
      );
    }
  }
);
