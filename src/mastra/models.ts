/**
 * AI Model Constants for Mastra Agents & Tools
 *
 * Central config for all model IDs used across the animation plugin.
 * Update these to swap models in one place.
 */

const DEFAULT_GEMINI_31_PRO_PREVIEW = 'google/gemini-3.1-pro-preview';

// -- Anthropic Claude Models --

export const CLAUDE_SONNET_4_6 = 'anthropic/claude-sonnet-4-6';
export const CLAUDE_OPUS_4_6 = 'anthropic/claude-opus-4-6';

const inferProviderFromModel = (model: string): string | null => {
  if (model.includes('/')) return model.split('/')[0] || null;
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google';
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  return null;
};

const normalizeModelOverride = (value: string, fallback: string): string => {
  if (value.includes('/')) return value;
  const fallbackProvider = inferProviderFromModel(fallback);
  if (fallbackProvider) return `${fallbackProvider}/${value}`;
  const inferredProvider = inferProviderFromModel(value);
  return inferredProvider ? `${inferredProvider}/${value}` : value;
};

const readModelOverride = (key: string, fallback: string): string => {
  const value = process.env[key]?.trim();
  if (!value || value.length === 0) return fallback;
  return normalizeModelOverride(value, fallback);
};

// -- Animation Plugin Models --

/** Orchestrator agent — coordinates planning, tool calls, and subagents */
export const ORCHESTRATOR_MODEL = readModelOverride(
  'KODA_MODEL_ORCHESTRATOR',
  CLAUDE_SONNET_4_6
);

/** Remotion (2D) code generator subagent */
export const REMOTION_CODE_GEN_MODEL = readModelOverride(
  'KODA_MODEL_CODEGEN_REMOTION',
  CLAUDE_SONNET_4_6
);

/** Theatre.js (3D) code generator subagent */
export const THEATRE_CODE_GEN_MODEL = readModelOverride(
  'KODA_MODEL_CODEGEN_THEATRE',
  CLAUDE_SONNET_4_6
);

/** Image analysis (vision) */
export const IMAGE_ANALYZER_MODEL = 'google/gemini-3-flash-preview';

/** Video analysis (native video understanding) */
export const VIDEO_ANALYZER_MODEL = 'google/gemini-3-flash-preview';

/** Animation prompt enhancer (design spec generation) */
export const ANIMATION_PROMPT_ENHANCER_MODEL = 'google/gemini-3-pro-preview';

// -- General Agents --

/** Image generation prompt enhancer */
export const PROMPT_ENHANCER_MODEL = 'google/gemini-3-pro-preview';

/** Prompt Studio creative director */
export const PROMPT_STUDIO_MODEL = readModelOverride(
  'KODA_MODEL_PROMPT_STUDIO',
  CLAUDE_SONNET_4_6
);
