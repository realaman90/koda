import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ── Types ────────────────────────────────────────────────────────────

interface PlanConfig {
  credits_per_month: number;
}

interface ImageModelConfig {
  fal_cost: number;
  credits: number;
}

interface VideoModelConfig {
  fal_cost_per_sec?: number;
  fal_cost_per_sec_audio?: number;
  fal_cost_per_video?: number;
  fal_cost_per_video_audio?: number;
  base_duration?: number;
  credits: number;
  credits_audio?: number;
}

interface AudioModelConfig {
  fal_cost: number;
  credits: number;
}

interface AnimationModelConfig {
  fal_cost: number;
  credits: number;
}

interface CostConfig {
  markup_multiplier: number;
  plans: Record<string, PlanConfig>;
  image: Record<string, ImageModelConfig>;
  video: Record<string, VideoModelConfig>;
  audio: Record<string, AudioModelConfig>;
  animation: Record<string, AnimationModelConfig>;
}

export type GenerationType = 'image' | 'video' | 'audio' | 'animation';

export interface CreditCostParams {
  model: string;
  duration?: number;
  generateAudio?: boolean;
}

// ── YAML Loading (cached at module level) ────────────────────────────

let _config: CostConfig | null = null;

function loadConfig(): CostConfig {
  if (_config) return _config;

  const yamlPath = path.join(process.cwd(), 'src/lib/credits/model-costs.yaml');
  const raw = fs.readFileSync(yamlPath, 'utf8');
  _config = yaml.load(raw) as CostConfig;
  return _config;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get the credit cost for a generation.
 *
 * For video models with per-second pricing, scales with duration.
 * For audio toggle, uses credits_audio when generateAudio=true.
 */
export function getCreditCost(
  type: GenerationType,
  params: CreditCostParams
): number {
  const config = loadConfig();
  const { model, duration, generateAudio } = params;

  if (type === 'image') {
    const modelConfig = config.image[model];
    if (!modelConfig) return 1; // unknown model fallback
    return modelConfig.credits;
  }

  if (type === 'video') {
    const modelConfig = config.video[model];
    if (!modelConfig) return 10; // unknown model fallback

    // Determine base credits (audio vs non-audio)
    const baseCredits = (generateAudio && modelConfig.credits_audio)
      ? modelConfig.credits_audio
      : modelConfig.credits;

    // Per-second models scale with duration
    if (modelConfig.fal_cost_per_sec && modelConfig.base_duration && duration) {
      const scale = duration / modelConfig.base_duration;
      return Math.max(baseCredits, Math.ceil(baseCredits * scale));
    }

    return baseCredits;
  }

  if (type === 'audio') {
    const modelConfig = config.audio[model];
    if (!modelConfig) return 1;
    return modelConfig.credits;
  }

  if (type === 'animation') {
    const modelConfig = config.animation[model];
    if (!modelConfig) return 5;
    return modelConfig.credits;
  }

  return 1;
}

/**
 * Get the monthly credit allocation for a Clerk plan key.
 */
export function getPlanCredits(planKey: string): number {
  const config = loadConfig();
  const plan = config.plans[planKey];
  return plan?.credits_per_month ?? FREE_TIER_CREDITS;
}

/** Default credits for free tier users */
export const FREE_TIER_CREDITS = 30;

/**
 * Credits granted to NEW free-tier users on first provisioning.
 * Reads EARLY_USER_FREE_CREDITS env var (default: YAML's free_user allocation).
 * Remove the env var to revert to the standard 30-credit allocation.
 */
export function getInitialFreeCredits(): number {
  const envVal = process.env.EARLY_USER_FREE_CREDITS;
  if (envVal !== undefined && envVal !== '') {
    const parsed = parseInt(envVal, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return getPlanCredits('free_user');
}

/** All recognized plan keys in priority order (highest first) */
export const PLAN_KEYS = ['pro_plus_user', 'pro_user', 'basic_user', 'free_user'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
