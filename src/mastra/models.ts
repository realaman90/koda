/**
 * AI Model Constants for Mastra Agents & Tools
 *
 * Central config for all model IDs used across the animation plugin.
 * Update these to swap models in one place.
 */

// -- Animation Plugin Models --

/** Orchestrator agent — coordinates planning, tool calls, and subagents */
export const ORCHESTRATOR_MODEL = 'anthropic/claude-opus-4-6';

/** Remotion (2D) code generator subagent */
export const REMOTION_CODE_GEN_MODEL = 'anthropic/claude-opus-4-6';

/** Theatre.js (3D) code generator subagent */
export const THEATRE_CODE_GEN_MODEL = 'anthropic/claude-opus-4-6';

/** Image analysis (vision) */
export const IMAGE_ANALYZER_MODEL = 'google/gemini-3-flash-preview';

/** Video analysis (native video understanding) */
export const VIDEO_ANALYZER_MODEL = 'google/gemini-3-flash-preview';

/** Animation prompt enhancer (design spec generation) */
export const ANIMATION_PROMPT_ENHANCER_MODEL = 'anthropic/claude-haiku-4-5';

// -- General Agents --

/** Image generation prompt enhancer */
export const PROMPT_ENHANCER_MODEL = 'anthropic/claude-haiku-4-5';
