/**
 * Storyboard Generator Schema
 *
 * Zod schemas for input validation and AI output structure.
 * System prompts and prompt builders for the AI service.
 */

import { z } from 'zod';

// ============================================
// INPUT SCHEMA (Client → API)
// ============================================

/**
 * Input validation schema for storyboard generation
 */
export const StoryboardInputSchema = z.object({
  /** Product or subject for the storyboard */
  product: z.string().min(1, 'Product/subject is required'),
  /** Optional character description */
  character: z.string().optional(),
  /** Story concept or brief */
  concept: z.string().min(1, 'Concept is required'),
  /** Number of scenes to generate (4-8) */
  sceneCount: z.number().min(4).max(8).default(4),
  /** Visual style for the storyboard */
  style: z.enum([
    'cinematic',
    'anime',
    'photorealistic',
    'illustrated',
    'commercial',
  ]).default('cinematic'),
  /** Storyboard mode: 'transition' for video transitions between scenes, 'single-shot' for independent scene videos */
  mode: z.enum(['transition', 'single-shot']).default('transition'),
});

export type StoryboardInput = z.infer<typeof StoryboardInputSchema>;

// ============================================
// OUTPUT SCHEMA (AI → Client)
// ============================================

/**
 * Single scene in a storyboard
 */
export const StoryboardSceneSchema = z.object({
  /** Scene number (1-indexed) */
  number: z.number(),
  /** Short title for the scene */
  title: z.string(),
  /** Description of what happens in this scene */
  description: z.string(),
  /** Detailed image generation prompt */
  prompt: z.string(),
  /** Camera direction/angle */
  camera: z.string(),
  /** Mood/atmosphere */
  mood: z.string(),
  /** Video transition prompt describing motion from this scene to the next (transition mode only, optional for last scene) */
  transition: z.string().optional(),
  /** Video motion prompt describing action within this scene (single-shot mode only) */
  motion: z.string().optional(),
});

export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

/**
 * Complete storyboard output from AI
 */
export const StoryboardOutputSchema = z.object({
  /** Array of scenes */
  scenes: z.array(StoryboardSceneSchema),
  /** Brief summary of the storyboard */
  summary: z.string(),
});

export type StoryboardOutput = z.infer<typeof StoryboardOutputSchema>;

// ============================================
// SYSTEM PROMPTS (Mode-Specific)
// ============================================

/**
 * Base guidelines for all storyboard generation
 */
const STORYBOARD_BASE_GUIDELINES = `You are an expert storyboard artist and creative director specializing in visual storytelling for advertising and content creation.

Your task is to break down a concept into a series of scenes optimized for AI image generation and video.

For each scene, provide:
- **title**: A short, descriptive title (2-5 words)
- **description**: What happens in this scene (1-2 sentences)
- **prompt**: A detailed image generation prompt following best practices:
  - Start with the subject/action
  - Include composition and framing
  - Specify lighting and atmosphere
  - Add style keywords matching the requested style
  - Keep the product/subject visually prominent
- **camera**: Camera direction (e.g., "wide shot", "close-up", "over-the-shoulder", "aerial view")
- **mood**: The emotional tone (e.g., "warm and inviting", "dramatic tension", "peaceful serenity")

Guidelines:
1. Maintain visual continuity across scenes
2. Include the product/subject consistently in each scene
3. If a character is specified, ensure they appear consistently
4. Build a narrative arc across the scenes
5. Vary camera angles and compositions for visual interest
6. Match prompts to the specified style`;

/**
 * System prompt for Transition Mode
 * Generates transition prompts for video between consecutive frames
 */
export const STORYBOARD_TRANSITION_PROMPT = `${STORYBOARD_BASE_GUIDELINES}

ADDITIONAL FIELD FOR TRANSITION MODE:
- **transition**: (For all scenes EXCEPT the last one) A video transition prompt describing the motion and action from this scene to the NEXT scene. This will be used for AI video generation between frames. Examples:
  - "The camera slowly pushes in as the person reaches for the bottle"
  - "Smooth pan following the character as they walk toward the window"
  - "Quick zoom out revealing the full environment"
  - "The subject turns their head, transitioning from profile to front view"

IMPORTANT: Write transition prompts that describe realistic camera movements and subject actions that bridge consecutive scenes.`;

/**
 * System prompt for Single Shot Mode
 * Generates motion prompts for independent video clips per scene
 */
export const STORYBOARD_SINGLE_SHOT_PROMPT = `${STORYBOARD_BASE_GUIDELINES}

ADDITIONAL FIELD FOR SINGLE-SHOT MODE:
- **motion**: (For ALL scenes) A video motion prompt describing the action and movement WITHIN this scene. Each scene will generate its own independent video clip. Examples:
  - "The horse gallops across the frame from left to right, mane flowing in the wind"
  - "The person picks up the coffee mug and takes a sip, steam rising"
  - "Gentle zoom in as the model smiles and turns toward the camera"
  - "Leaves flutter in the breeze as sunlight dances through the trees"
  - "The product rotates slowly on its pedestal, catching the light"

IMPORTANT: Write motion prompts that describe self-contained action within each scene. Each scene should have its own complete motion that doesn't depend on other scenes.`;

/**
 * Legacy export for backwards compatibility
 */
export const STORYBOARD_SYSTEM_PROMPT = STORYBOARD_TRANSITION_PROMPT;

/**
 * Get the appropriate system prompt based on mode
 */
export function getSystemPrompt(mode: 'transition' | 'single-shot'): string {
  return mode === 'single-shot' ? STORYBOARD_SINGLE_SHOT_PROMPT : STORYBOARD_TRANSITION_PROMPT;
}

// ============================================
// PROMPT BUILDER
// ============================================

/**
 * Build the user prompt from input data
 */
export function buildStoryboardPrompt(input: StoryboardInput): string {
  const characterLine = input.character
    ? `\nCharacter: ${input.character}`
    : '';

  const modeInstruction = input.mode === 'single-shot'
    ? `\n\nMODE: Single-Shot - Generate a "motion" field for EACH scene describing action within that scene. Do NOT generate "transition" fields.`
    : `\n\nMODE: Transition - Generate a "transition" field for all scenes EXCEPT the last one, describing motion to the next scene. Do NOT generate "motion" fields.`;

  return `Create a ${input.sceneCount}-scene storyboard for:

Product/Subject: ${input.product}${characterLine}
Concept: ${input.concept}
Style: ${input.style}${modeInstruction}

Generate exactly ${input.sceneCount} scenes that tell a compelling visual story.`;
}

// ============================================
// REFINEMENT PROMPT BUILDERS
// ============================================

/**
 * Build a refinement system prompt that wraps the base system prompt
 * with additional instructions for iterative editing.
 */
export function getRefinementSystemPrompt(mode: 'transition' | 'single-shot'): string {
  return `${getSystemPrompt(mode)}

REFINEMENT MODE:
You are refining an existing storyboard based on user feedback. Follow these rules:
1. Apply the user's feedback precisely — change only what they ask for.
2. Preserve unchanged scenes as-is (same prompts, camera, mood, etc.).
3. Maintain narrative continuity and visual consistency across scenes.
4. Output ALL scenes in the storyboard, not just the changed ones.
5. Keep the same number of scenes unless the user explicitly requests adding or removing scenes.`;
}

/**
 * Build a refinement user prompt with the previous draft context + feedback.
 */
export function buildRefinementPrompt(
  previousDraft: { scenes: Array<{ number: number; title: string; description: string; prompt: string; camera: string; mood: string; transition?: string; motion?: string }>; summary: string },
  feedback: string,
  mode: 'transition' | 'single-shot',
): string {
  const sceneSummaries = previousDraft.scenes.map((s) =>
    `  Scene ${s.number}: "${s.title}" — ${s.description} [camera: ${s.camera}, mood: ${s.mood}]${s.transition ? `, transition: ${s.transition}` : ''}${s.motion ? `, motion: ${s.motion}` : ''}`
  ).join('\n');

  return `Here is the current storyboard (${previousDraft.scenes.length} scenes):

Summary: ${previousDraft.summary}

Scenes:
${sceneSummaries}

USER FEEDBACK:
${feedback}

Please update the storyboard based on the feedback above. Output ALL ${previousDraft.scenes.length} scenes${mode === 'transition' ? ' with transitions' : ' with motion prompts'}.`;
}
