import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS } from '@/lib/types';
import { getAssetStorageType, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';
import { withCredits } from '@/lib/credits/with-credits';

export const maxDuration = 300;

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

type FalLikeError = {
  message?: string;
  status?: number;
  body?: {
    message?: string;
    detail?: string | Array<{ msg?: string; loc?: Array<string | number> }>;
  };
};

const ELEVEN_V3_VOICE_MAP: Record<string, string> = {
  alloy: 'Rachel',
  echo: 'George',
  fable: 'Thomas',
  onyx: 'Antoni',
  nova: 'Emily',
  shimmer: 'Elli',
  rachel: 'Rachel',
  drew: 'Drew',
  clyde: 'Clyde',
  paul: 'Paul',
  domi: 'Domi',
  dave: 'Dave',
  fin: 'Fin',
  sarah: 'Sarah',
  antoni: 'Antoni',
  thomas: 'Thomas',
  charlie: 'Charlie',
  george: 'George',
  emily: 'Emily',
  elli: 'Elli',
};
const ELEVEN_DIALOGUE_MODEL = 'fal-ai/elevenlabs/text-to-dialogue/eleven-v3';
const DIALOGUE_STABILITY_VALUES = [0, 0.5, 1] as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function snapDialogueStability(value: unknown): 0 | 0.5 | 1 {
  const clamped = clamp(value, 0, 1, 0.5);
  return DIALOGUE_STABILITY_VALUES.reduce((closest, candidate) =>
    Math.abs(candidate - clamped) < Math.abs(closest - clamped) ? candidate : closest
  );
}

function normalizeVoice(value: unknown, fallback = 'Rachel'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return ELEVEN_V3_VOICE_MAP[trimmed.toLowerCase()] || trimmed;
}

function normalizeDialogueLines(value: unknown): Array<{ text: string; voice: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => {
      if (!line || typeof line !== 'object') return null;
      const candidate = line as { text?: unknown; voice?: unknown };
      const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
      if (!text) return null;
      const voice = normalizeVoice(candidate.voice);
      return { text, voice };
    })
    .filter((line): line is { text: string; voice: string } => !!line);
}

function parseFalError(error: unknown): { message: string; status: number } {
  const falErr = error as FalLikeError;
  const status = typeof falErr?.status === 'number' ? falErr.status : 500;

  const detail = Array.isArray(falErr?.body?.detail)
    ? falErr.body!.detail
        .map((item) => `${item.loc?.join('.') || 'input'}: ${item.msg || 'invalid value'}`)
        .join('; ')
    : typeof falErr?.body?.detail === 'string'
      ? falErr.body.detail
      : undefined;

  const message =
    detail ||
    falErr?.body?.message ||
    falErr?.message ||
    'Speech generation failed';

  return { message, status };
}

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

export const POST = withCredits(
  { type: 'audio', getCostParams: () => ({ model: 'elevenlabs-tts' }) },
  async (request) => {
    try {
      const body = await request.json();
      const {
        mode,
        text,
        voice,
        speed,
        stability,
        dialogueLines,
      } = body;
      const selectedMode = mode === 'dialogue' ? 'dialogue' : 'single';

      const runSpeech = async (speechModelId: string, input: Record<string, unknown>) => {
        const result = await fal.subscribe(speechModelId, {
          input,
          logs: true,
          onQueueUpdate: (update) => {
            console.log('Speech queue update:', update.status);
          },
        });

        console.log('Speech generation result:', result);

        const data = result.data as
          | {
              audio?: { url?: string };
              output?: { audio?: { url?: string } };
              result?: { audio?: { url?: string } };
            }
          | undefined;

        const audioUrl = data?.audio?.url || data?.output?.audio?.url || data?.result?.audio?.url;
        if (!audioUrl) {
          throw new Error('No audio generated');
        }
        return audioUrl;
      };

      let modelId: string;
      let input: Record<string, unknown>;
      let metadataText: string;
      let mappedVoice: string | undefined;

      if (selectedMode === 'dialogue') {
        const lines = normalizeDialogueLines(dialogueLines);
        if (lines.length < 2) {
          return NextResponse.json(
            { error: 'Dialogue mode requires at least 2 non-empty lines' },
            { status: 400 }
          );
        }

        const mappedInputs = lines.map((line) => ({
          text: line.text,
          voice: normalizeVoice(line.voice),
        }));

        modelId = ELEVEN_DIALOGUE_MODEL;
        input = {
          inputs: mappedInputs,
          stability: snapDialogueStability(stability),
        };
        metadataText = lines.map((line) => `${line.voice}: ${line.text}`).join('\n');
      } else {
        const finalText = typeof text === 'string' ? text.trim() : '';
        if (!finalText) {
          return NextResponse.json(
            { error: 'Text is required' },
            { status: 400 }
          );
        }

        mappedVoice = normalizeVoice(voice);
        modelId = FAL_AUDIO_MODELS['elevenlabs-tts'];
        input = {
          text: finalText,
          voice: mappedVoice,
          speed: clamp(speed, 0.7, 1.2, 1.0),
          stability: clamp(stability, 0, 1, 0.5),
          apply_text_normalization: 'auto' as const,
        };
        metadataText = finalText;
      }

      console.log('Speech generation request:', { mode: selectedMode, modelId, input });

      let audioUrl: string;
      try {
        audioUrl = await runSpeech(modelId, input);
      } catch (error) {
        const parsed = parseFalError(error);
        if (parsed.status === 422 && selectedMode === 'single' && mappedVoice && mappedVoice !== 'Rachel') {
          console.warn('Speech generation 422, retrying with Rachel voice:', parsed.message);
          audioUrl = await runSpeech(modelId, { ...input, voice: 'Rachel' });
        } else if (parsed.status === 422 && selectedMode === 'dialogue') {
          console.warn('Dialogue generation 422, retrying with Rachel voices:', parsed.message);
          const dialogueInput = input as { inputs?: Array<{ text: string; voice: string }>; stability?: number };
          audioUrl = await runSpeech(modelId, {
            inputs: (dialogueInput.inputs || []).map((entry) => ({ ...entry, voice: 'Rachel' })),
            stability: dialogueInput.stability ?? 0.5,
          });
        } else {
          throw error;
        }
      }

      // Save audio to configured asset storage
      const { canvasId, nodeId } = body;
      const savedUrl = await saveGeneratedAudio(audioUrl, {
        text: metadataText,
        model: modelId,
        canvasId,
        nodeId,
      });

      return NextResponse.json({
        success: true,
        audioUrl: savedUrl,
        originalUrl: audioUrl,
        model: modelId,
        mode: selectedMode,
        ...(mappedVoice ? { voice: mappedVoice } : {}),
      });
    } catch (error) {
      console.error('Speech generation error:', error);
      const parsed = parseFalError(error);
      return NextResponse.json(
        { error: parsed.message },
        { status: parsed.status }
      );
    }
  }
);
