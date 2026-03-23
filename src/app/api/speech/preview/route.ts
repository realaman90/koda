import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS } from '@/lib/types';

fal.config({
  credentials: process.env.FAL_KEY,
});

const PREVIEW_TEXT_FALLBACK = 'Hello, this is a quick preview of this voice.';
const MAX_PREVIEW_CHARS = 220;

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

type FalLikeError = {
  message?: string;
  status?: number;
  body?: {
    message?: string;
    detail?: string | Array<{ msg?: string; loc?: Array<string | number> }>;
  };
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeVoice(value: unknown, fallback = 'Rachel'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return ELEVEN_V3_VOICE_MAP[trimmed.toLowerCase()] || trimmed;
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
    'Voice preview failed';

  return { message, status };
}

function getAudioUrl(result: unknown): string | null {
  const data = result as
    | {
        audio?: { url?: string };
        output?: { audio?: { url?: string } };
        result?: { audio?: { url?: string } };
      }
    | undefined;

  return data?.audio?.url || data?.output?.audio?.url || data?.result?.audio?.url || null;
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const requestedText = typeof body?.text === 'string' ? body.text.trim() : '';
    const previewText = (requestedText || PREVIEW_TEXT_FALLBACK).slice(0, MAX_PREVIEW_CHARS);
    const mappedVoice = normalizeVoice(body?.voice);

    const input = {
      text: previewText,
      voice: mappedVoice,
      speed: clamp(body?.speed, 0.7, 1.2, 1.0),
      stability: clamp(body?.stability, 0, 1, 0.5),
      apply_text_normalization: 'auto' as const,
    };

    const result = await fal.subscribe(FAL_AUDIO_MODELS['elevenlabs-tts'], {
      input,
      logs: false,
    });

    const audioUrl = getAudioUrl(result.data);
    if (!audioUrl) {
      throw new Error('No preview audio generated');
    }

    return NextResponse.json({
      success: true,
      audioUrl,
      voice: mappedVoice,
      previewText,
    });
  } catch (error) {
    console.error('Voice preview error:', error);
    const parsed = parseFalError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
