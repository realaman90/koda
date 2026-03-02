import type {
  AnimationPlan,
  MediaEntry,
  MotionCamera,
  MotionEnergy,
  MotionFeel,
  MotionIntentChips,
  MotionPreset,
  MotionReferenceProfile,
  MotionSemanticEditLog,
  MotionSliders,
  MotionSpec,
  MotionTransitions,
  MotionVariantId,
} from './types';

export interface MotionVariantOption {
  id: MotionVariantId;
  label: string;
  description: string;
  spec: MotionSpec;
}

export interface SemanticMotionEditResult {
  recognized: boolean;
  patchedSpec: MotionSpec;
  patchedPlan?: AnimationPlan;
  instruction: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clampSlider = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export const DEFAULT_MOTION_CHIPS: MotionIntentChips = {
  energy: 'medium',
  feel: 'smooth',
  camera: 'subtle',
  transitions: 'minimal',
};

export const DEFAULT_MOTION_SLIDERS: MotionSliders = {
  speed: 50,
  intensity: 50,
  smoothness: 60,
  cameraActivity: 45,
  transitionAggressiveness: 45,
};

export const MOTION_SLIDER_LABELS: Record<keyof MotionSliders, string> = {
  speed: 'Speed',
  intensity: 'Intensity',
  smoothness: 'Smoothness',
  cameraActivity: 'Camera activity',
  transitionAggressiveness: 'Transition aggressiveness',
};

const VAGUE_PATTERNS = [
  /\b(make|create)\b.{0,20}\b(animation|video)\b/i,
  /\bsomething\b/i,
  /\bwhatever\b/i,
  /\bidk\b/i,
  /\byou decide\b/i,
  /\bcool\b/i,
];

const MOTION_TERMS =
  /\b(fade|slide|zoom|camera|transition|timing|easing|stagger|spring|bounce|snappy|smooth|dramatic|subtle|parallax|intro|outro|scene)\b/i;

const MOTION_KEYWORD_FAST = /\b(fast|quick|energetic|dynamic|rapid|snappy)\b/i;
const MOTION_KEYWORD_SMOOTH = /\b(smooth|calm|gentle|soft|cinematic|floating)\b/i;
const MOTION_KEYWORD_BOUNCY = /\b(bouncy|bounce|pop|playful)\b/i;
const MOTION_KEYWORD_CAMERA_DYNAMIC = /\b(handheld|whip|pan|tilt|zoom|tracking|orbit|dynamic camera)\b/i;
const MOTION_KEYWORD_CAMERA_STATIC = /\b(static|locked|still)\b/i;

export function isLowConfidenceMotionPrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return true;
  if (trimmed.length <= 24) return true;

  const hasMotionDetails = MOTION_TERMS.test(trimmed);
  const hasGenericPattern = VAGUE_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (!hasMotionDetails && words.length < 14) return true;
  if (hasGenericPattern && !hasMotionDetails) return true;

  return false;
}

export function createMotionSpec(params?: Partial<MotionSpec>): MotionSpec {
  return {
    chips: {
      ...DEFAULT_MOTION_CHIPS,
      ...(params?.chips || {}),
    },
    sliders: {
      ...DEFAULT_MOTION_SLIDERS,
      ...(params?.sliders || {}),
    },
    variant: params?.variant || 'balanced',
    source: params?.source || 'manual',
    updatedAt: params?.updatedAt || new Date().toISOString(),
    ...(params?.followUp ? { followUp: params.followUp } : {}),
    ...(params?.holdFinalFrameSeconds ? { holdFinalFrameSeconds: params.holdFinalFrameSeconds } : {}),
    ...(params?.referenceProfile ? { referenceProfile: params.referenceProfile } : {}),
    ...(params?.semanticEdits ? { semanticEdits: params.semanticEdits } : {}),
    ...(params?.presetId ? { presetId: params.presetId } : {}),
  };
}

function slidersFromChips(chips: MotionIntentChips): MotionSliders {
  const energyShift = chips.energy === 'calm' ? -20 : chips.energy === 'energetic' ? 20 : 0;
  const feelAdjustments: Record<MotionFeel, Partial<MotionSliders>> = {
    smooth: { smoothness: 80, intensity: 45 },
    snappy: { speed: 65, smoothness: 45, intensity: 60 },
    bouncy: { speed: 70, intensity: 75, smoothness: 35 },
  };
  const cameraActivity = chips.camera === 'static' ? 20 : chips.camera === 'dynamic' ? 80 : 50;
  const transitionAggressiveness =
    chips.transitions === 'cinematic'
      ? 70
      : chips.energy === 'calm'
        ? 30
        : 45;

  const base: MotionSliders = {
    ...DEFAULT_MOTION_SLIDERS,
    speed: clampSlider(DEFAULT_MOTION_SLIDERS.speed + energyShift),
    intensity: clampSlider(DEFAULT_MOTION_SLIDERS.intensity + energyShift),
    cameraActivity,
    transitionAggressiveness,
  };

  const feel = feelAdjustments[chips.feel];
  return {
    speed: clampSlider(feel.speed ?? base.speed),
    intensity: clampSlider(feel.intensity ?? base.intensity),
    smoothness: clampSlider(feel.smoothness ?? base.smoothness),
    cameraActivity: clampSlider(base.cameraActivity),
    transitionAggressiveness: clampSlider(base.transitionAggressiveness),
  };
}

function applyVariant(sliders: MotionSliders, variant: MotionVariantId): MotionSliders {
  if (variant === 'safe') {
    return {
      speed: clampSlider(sliders.speed - 15),
      intensity: clampSlider(sliders.intensity - 20),
      smoothness: clampSlider(sliders.smoothness + 15),
      cameraActivity: clampSlider(sliders.cameraActivity - 20),
      transitionAggressiveness: clampSlider(sliders.transitionAggressiveness - 15),
    };
  }
  if (variant === 'dramatic') {
    return {
      speed: clampSlider(sliders.speed + 15),
      intensity: clampSlider(sliders.intensity + 25),
      smoothness: clampSlider(sliders.smoothness - 15),
      cameraActivity: clampSlider(sliders.cameraActivity + 25),
      transitionAggressiveness: clampSlider(sliders.transitionAggressiveness + 20),
    };
  }
  return sliders;
}

export function createGuidedMotionSpec(
  chips: MotionIntentChips,
  variant: MotionVariantId,
  followUp?: string,
  referenceProfile?: MotionReferenceProfile
): MotionSpec {
  const baseSliders = slidersFromChips(chips);
  const sliders = applyVariant(baseSliders, variant);
  return createMotionSpec({
    chips,
    sliders,
    variant,
    source: variant === 'balanced' ? 'guided' : 'variant',
    followUp: followUp?.trim() || undefined,
    referenceProfile,
  });
}

export function buildMotionVariants(baseSpec: MotionSpec): MotionVariantOption[] {
  const variants: Array<{ id: MotionVariantId; label: string; description: string }> = [
    { id: 'safe', label: 'A · Subtle', description: 'Low-risk, polished, minimal movement.' },
    { id: 'balanced', label: 'B · Balanced', description: 'Moderate energy, product-safe motion.' },
    { id: 'dramatic', label: 'C · Dramatic', description: 'High energy, stronger camera and transitions.' },
  ];
  return variants.map((variant) => ({
    ...variant,
    spec: createMotionSpec({
      ...baseSpec,
      variant: variant.id,
      source: 'variant',
      sliders: applyVariant(baseSpec.sliders, variant.id),
    }),
  }));
}

function scaleSceneDuration(sceneDuration: number, factor: number): number {
  return Math.max(1.5, Math.round(sceneDuration * factor * 10) / 10);
}

function addSemanticLog(spec: MotionSpec, phrase: string, patchSummary: string): MotionSpec {
  const log: MotionSemanticEditLog = {
    id: `sem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    phrase,
    appliedAt: new Date().toISOString(),
    patchSummary,
  };
  return createMotionSpec({
    ...spec,
    source: 'semantic-edit',
    semanticEdits: [...(spec.semanticEdits || []), log].slice(-12),
    updatedAt: new Date().toISOString(),
  });
}

export function applySemanticMotionEdit(
  phrase: string,
  currentSpec?: MotionSpec,
  currentPlan?: AnimationPlan
): SemanticMotionEditResult {
  const baseSpec = currentSpec || createMotionSpec();
  const lower = phrase.toLowerCase();
  let nextSpec = createMotionSpec(baseSpec);
  const nextPlan = currentPlan ? { ...currentPlan, scenes: currentPlan.scenes.map((s) => ({ ...s })) } : undefined;
  const patches: string[] = [];

  const slowerIntro = lower.match(/(?:slower|slow down)\s+intro(?:\s+(\d{1,3})%?)?/);
  if (slowerIntro) {
    const pct = slowerIntro[1] ? Math.min(80, Math.max(5, Number(slowerIntro[1]))) : 20;
    const factor = 1 + pct / 100;
    nextSpec = createMotionSpec({
      ...nextSpec,
      sliders: {
        ...nextSpec.sliders,
        speed: clampSlider(nextSpec.sliders.speed - Math.round(pct * 0.4)),
      },
    });
    if (nextPlan && nextPlan.scenes.length > 0) {
      nextPlan.scenes[0].duration = scaleSceneDuration(nextPlan.scenes[0].duration, factor);
      nextPlan.totalDuration = Math.round(nextPlan.scenes.reduce((sum, s) => sum + s.duration, 0) * 10) / 10;
    }
    patches.push(`intro ${pct}% slower`);
  }

  if (/\b(less bounce|reduce bounce|decrease bounce)\b/.test(lower)) {
    nextSpec = createMotionSpec({
      ...nextSpec,
      chips: { ...nextSpec.chips, feel: 'smooth' },
      sliders: {
        ...nextSpec.sliders,
        intensity: clampSlider(nextSpec.sliders.intensity - 18),
        smoothness: clampSlider(nextSpec.sliders.smoothness + 18),
      },
    });
    patches.push('reduced bounce');
  }

  const holdFinalFrame = lower.match(/hold final frame\s+(\d+(?:\.\d+)?)\s*s?/);
  if (holdFinalFrame) {
    const hold = Math.max(0.2, Math.min(4, Number(holdFinalFrame[1])));
    nextSpec = createMotionSpec({
      ...nextSpec,
      holdFinalFrameSeconds: hold,
    });
    if (nextPlan && nextPlan.scenes.length > 0) {
      const lastIdx = nextPlan.scenes.length - 1;
      nextPlan.scenes[lastIdx].duration = Math.round((nextPlan.scenes[lastIdx].duration + hold) * 10) / 10;
      nextPlan.totalDuration = Math.round((nextPlan.totalDuration + hold) * 10) / 10;
    }
    patches.push(`hold final frame ${hold}s`);
  }

  if (/\b(transitions? smoother|smoother transitions?)\b/.test(lower)) {
    nextSpec = createMotionSpec({
      ...nextSpec,
      chips: { ...nextSpec.chips, transitions: 'minimal' },
      sliders: {
        ...nextSpec.sliders,
        smoothness: clampSlider(nextSpec.sliders.smoothness + 15),
        transitionAggressiveness: clampSlider(nextSpec.sliders.transitionAggressiveness - 18),
      },
    });
    patches.push('smoothed transitions');
  }

  if (patches.length === 0) {
    return {
      recognized: false,
      patchedSpec: baseSpec,
      patchedPlan: currentPlan,
      instruction: '',
    };
  }

  const summary = patches.join(', ');
  const loggedSpec = addSemanticLog(nextSpec, phrase, summary);
  const instruction = [
    'Apply these deterministic motion patches to the existing animation code (targeted update, no full rebuild unless required):',
    ...patches.map((patch) => `- ${patch}`),
    'Preserve existing scene content; update timing/easing/camera parameters only.',
  ].join('\n');

  return {
    recognized: true,
    patchedSpec: loggedSpec,
    patchedPlan: nextPlan,
    instruction,
  };
}

function inferFeelFromText(text: string): MotionFeel {
  if (MOTION_KEYWORD_BOUNCY.test(text)) return 'bouncy';
  if (MOTION_KEYWORD_FAST.test(text)) return 'snappy';
  if (MOTION_KEYWORD_SMOOTH.test(text)) return 'smooth';
  return 'smooth';
}

function inferCamera(text: string): MotionCamera {
  if (MOTION_KEYWORD_CAMERA_DYNAMIC.test(text)) return 'dynamic';
  if (MOTION_KEYWORD_CAMERA_STATIC.test(text)) return 'static';
  return 'subtle';
}

function inferEnergy(text: string): MotionEnergy {
  if (MOTION_KEYWORD_FAST.test(text)) return 'energetic';
  if (MOTION_KEYWORD_SMOOTH.test(text)) return 'calm';
  return 'medium';
}

function inferTransitions(text: string): MotionTransitions {
  if (/\b(cinematic|filmic|dramatic)\b/.test(text)) return 'cinematic';
  return 'minimal';
}

export function extractReferenceMotionProfile(media: MediaEntry[]): MotionReferenceProfile | undefined {
  const candidates = media
    .filter((entry) => entry.source === 'upload')
    .filter(
      (entry) =>
        entry.type === 'video' ||
        entry.mimeType?.includes('gif') ||
        entry.name.toLowerCase().endsWith('.gif')
    );

  if (candidates.length === 0) return undefined;

  const candidate = [...candidates].reverse()[0];
  const combined = `${candidate.name} ${candidate.description || ''}`.toLowerCase();
  const duration = candidate.duration || (candidate.type === 'video' ? 5 : 3);

  const pacingBase = duration <= 3 ? 0.75 : duration >= 8 ? 0.35 : 0.55;
  const pacing = clamp01(
    pacingBase +
      (MOTION_KEYWORD_FAST.test(combined) ? 0.15 : 0) -
      (MOTION_KEYWORD_SMOOTH.test(combined) ? 0.1 : 0)
  );
  const cutRhythm = clamp01(pacing + (/\b(cut|montage|fast edits?)\b/.test(combined) ? 0.15 : -0.05));
  const cameraEnergy = clamp01(
    (inferCamera(combined) === 'dynamic' ? 0.8 : inferCamera(combined) === 'static' ? 0.25 : 0.5) +
      (MOTION_KEYWORD_FAST.test(combined) ? 0.1 : 0)
  );
  const easingTendency = inferFeelFromText(combined);

  return {
    sourceMediaId: candidate.id,
    sourceName: candidate.name,
    sourceType: candidate.mimeType?.includes('gif') || candidate.name.toLowerCase().endsWith('.gif') ? 'gif' : 'video',
    pacing,
    cutRhythm,
    cameraEnergy,
    easingTendency,
    summary: `Inferred from ${candidate.name}: pacing ${Math.round(pacing * 100)}%, camera energy ${Math.round(cameraEnergy * 100)}%, ${easingTendency} easing.`,
  };
}

function chipsFromReference(profile: MotionReferenceProfile): MotionIntentChips {
  const energy: MotionEnergy = profile.pacing > 0.65 ? 'energetic' : profile.pacing < 0.4 ? 'calm' : 'medium';
  const camera: MotionCamera = profile.cameraEnergy > 0.68 ? 'dynamic' : profile.cameraEnergy < 0.35 ? 'static' : 'subtle';
  const transitions: MotionTransitions = profile.cutRhythm > 0.62 ? 'cinematic' : 'minimal';
  return {
    energy,
    feel: profile.easingTendency,
    camera,
    transitions,
  };
}

export function seedMotionSpecFromReference(profile: MotionReferenceProfile, current?: MotionSpec): MotionSpec {
  const chips = chipsFromReference(profile);
  const variant: MotionVariantId = profile.cameraEnergy > 0.7 ? 'dramatic' : profile.pacing < 0.4 ? 'safe' : 'balanced';
  const base = createGuidedMotionSpec(chips, variant, current?.followUp, profile);
  return createMotionSpec({
    ...base,
    source: 'reference-profile',
    referenceProfile: profile,
  });
}

export function makeMotionPresetName(existing: MotionPreset[], base = 'My Motion Preset'): string {
  const names = new Set(existing.map((preset) => preset.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let i = 2;
  while (names.has(`${base} ${i}`.toLowerCase())) i += 1;
  return `${base} ${i}`;
}

export function deriveGuidedChipsFromPrompt(prompt: string): MotionIntentChips {
  const lower = prompt.toLowerCase();
  return {
    energy: inferEnergy(lower),
    feel: inferFeelFromText(lower),
    camera: inferCamera(lower),
    transitions: inferTransitions(lower),
  };
}
