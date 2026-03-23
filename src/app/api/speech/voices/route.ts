import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { DEFAULT_ELEVENLABS_VOICE_LABELS } from '@/lib/types';

fal.config({
  credentials: process.env.FAL_KEY,
});

type FalVoiceInfo = {
  voice_id?: unknown;
  voice_name?: unknown;
  voice_description?: unknown;
  created_at?: unknown;
};

type VoiceOption = {
  value: string;
  label: string;
  description?: string;
  group: 'Built-in' | 'Custom';
};

const DEFAULT_VOICE_OPTIONS: VoiceOption[] = Object.entries(DEFAULT_ELEVENLABS_VOICE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
    group: 'Built-in',
  })
);

function parseCustomVoice(entry: FalVoiceInfo): VoiceOption | null {
  const voiceId = typeof entry.voice_id === 'string' ? entry.voice_id.trim() : '';
  if (!voiceId) return null;

  const voiceName = typeof entry.voice_name === 'string' ? entry.voice_name.trim() : '';
  const voiceDescription = typeof entry.voice_description === 'string' ? entry.voice_description.trim() : '';
  const createdAt = typeof entry.created_at === 'number' && Number.isFinite(entry.created_at)
    ? entry.created_at
    : null;

  const label = voiceName || voiceId;
  const createdLabel = createdAt ? `Created ${new Date(createdAt * 1000).toLocaleDateString('en-US')}` : undefined;
  const description = [voiceDescription, createdLabel].filter(Boolean).join(' · ') || undefined;

  return {
    value: voiceId,
    label,
    description,
    group: 'Custom',
  };
}

export async function GET() {
  const voicesByValue = new Map<string, VoiceOption>();
  for (const option of DEFAULT_VOICE_OPTIONS) {
    voicesByValue.set(option.value, option);
  }

  let customVoicesCount = 0;

  if (process.env.FAL_KEY) {
    try {
      const result = await fal.subscribe('fal-ai/elevenlabs/list-voices', {
        input: {},
        logs: false,
      });

      const data = result.data as { voices?: unknown } | undefined;
      if (Array.isArray(data?.voices)) {
        for (const item of data.voices) {
          if (!item || typeof item !== 'object') continue;
          const parsed = parseCustomVoice(item as FalVoiceInfo);
          if (!parsed) continue;
          customVoicesCount += 1;
          voicesByValue.set(parsed.value, parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load ElevenLabs custom voices from Fal:', error);
    }
  }

  const builtIn = Array.from(voicesByValue.values())
    .filter((voice) => voice.group === 'Built-in')
    .sort((a, b) => a.label.localeCompare(b.label));

  const custom = Array.from(voicesByValue.values())
    .filter((voice) => voice.group === 'Custom')
    .sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json({
    voices: [...builtIn, ...custom],
    customVoicesCount,
  });
}
