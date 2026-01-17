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
// SYSTEM PROMPT
// ============================================

/**
 * System prompt for the storyboard AI
 * Guides the AI to generate consistent, high-quality storyboard scenes
 */
export const STORYBOARD_SYSTEM_PROMPT = `You are an expert storyboard artist and creative director specializing in visual storytelling for advertising and content creation.

Your task is to break down a concept into a series of scenes optimized for AI image generation.

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

  return `Create a ${input.sceneCount}-scene storyboard for:

Product/Subject: ${input.product}${characterLine}
Concept: ${input.concept}
Style: ${input.style}

Generate exactly ${input.sceneCount} scenes that tell a compelling visual story.`;
}
