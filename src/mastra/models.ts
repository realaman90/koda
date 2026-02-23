/**
 * AI Model Constants for Mastra Agents & Tools
 *
 * Central config for all model IDs used across the animation plugin.
 * Update these to swap models in one place.
 */

const DEFAULT_GEMINI_31_PRO_PREVIEW = 'google/gemini-3.1-pro-preview';

const readModelOverride = (key: string, fallback: string): string => {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
};

// -- Animation Plugin Models --

/** Orchestrator agent — coordinates planning, tool calls, and subagents */
export const ORCHESTRATOR_MODEL = readModelOverride(
  'KODA_MODEL_ORCHESTRATOR',
  DEFAULT_GEMINI_31_PRO_PREVIEW
);

/** Remotion (2D) code generator subagent */
export const REMOTION_CODE_GEN_MODEL = readModelOverride(
  'KODA_MODEL_CODEGEN_REMOTION',
  DEFAULT_GEMINI_31_PRO_PREVIEW
);

/** Theatre.js (3D) code generator subagent */
export const THEATRE_CODE_GEN_MODEL = readModelOverride(
  'KODA_MODEL_CODEGEN_THEATRE',
  DEFAULT_GEMINI_31_PRO_PREVIEW
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
