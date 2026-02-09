/**
 * Product Shot Schema
 *
 * Zod schemas for input validation and AI output structure.
 * System prompts and prompt builders for the AI service.
 */

import { z } from 'zod';

// ============================================
// INPUT SCHEMA (Client → API)
// ============================================

/**
 * Input validation schema for product shot generation
 */
export const ProductShotInputSchema = z.object({
  /** Product name/description */
  productName: z.string().min(1, 'Product name is required'),
  /** Number of shots to generate (4, 6, or 8) */
  shotCount: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(4),
  /** Background preset */
  background: z.enum([
    'studio-white',
    'gradient',
    'lifestyle',
    'outdoor',
    'dark-moody',
  ]).default('studio-white'),
  /** Lighting preset */
  lighting: z.enum([
    'soft',
    'dramatic',
    'natural',
    'rim-light',
  ]).default('soft'),
  /** Additional notes or instructions */
  additionalNotes: z.string().optional(),
});

export type ProductShotInput = z.infer<typeof ProductShotInputSchema>;

// ============================================
// OUTPUT SCHEMA (AI → Client)
// ============================================

/**
 * Single shot in a product shot plan
 */
export const ProductShotShotSchema = z.object({
  /** Shot number (1-indexed) */
  number: z.number(),
  /** Name of the angle/shot type (e.g., "Hero Shot", "Flat Lay") */
  angleName: z.string(),
  /** Description of this shot */
  description: z.string(),
  /** Full image generation prompt */
  prompt: z.string(),
  /** Camera angle/position */
  camera: z.string(),
  /** Framing and composition notes */
  composition: z.string(),
});

export type ProductShotShot = z.infer<typeof ProductShotShotSchema>;

/**
 * Complete product shot output from AI
 */
export const ProductShotOutputSchema = z.object({
  /** Array of shots */
  shots: z.array(ProductShotShotSchema),
  /** Brief summary of the shot plan */
  summary: z.string(),
});

export type ProductShotOutput = z.infer<typeof ProductShotOutputSchema>;

// ============================================
// SYSTEM PROMPT
// ============================================

export const PRODUCT_SHOT_SYSTEM_PROMPT = `You are an expert product photographer and creative director specializing in e-commerce and advertising photography.

Your task is to create an optimal shot list for a product, generating detailed image prompts for each angle.

For each shot, provide:
- **angleName**: A descriptive name for the shot type (e.g., "Hero Shot", "3/4 Angle", "Flat Lay", "Detail Close-up", "Low Angle", "Top Down", "Side Profile", "Back View", "Packaging Shot")
- **description**: What this shot showcases and why it's important (1-2 sentences)
- **prompt**: A detailed image generation prompt optimized for NanoBanana Pro. Include:
  - The product as the clear subject
  - Exact camera angle and distance
  - Background description matching the requested preset
  - Lighting setup matching the requested preset
  - Composition and framing details
  - Professional photography keywords (depth of field, focal length, etc.)
  - Style: product photography, commercial, high-end
- **camera**: Camera angle and position (e.g., "3/4 elevated view at 45 degrees", "straight-on eye level", "directly overhead bird's eye")
- **composition**: Framing notes (e.g., "centered with negative space on right", "rule of thirds, product in left third", "tight crop filling 80% of frame")

Guidelines:
1. Choose shot types that best showcase the specific product category
2. Vary camera angles for visual diversity - never repeat the same angle
3. Always start with the hero shot (most impactful marketing angle)
4. Include at least one detail/close-up shot
5. Include at least one lifestyle/contextual shot when appropriate
6. Every prompt MUST incorporate the specified background and lighting settings
7. Prompts should be rich with professional photography terminology
8. Maintain consistent product appearance across all shots
9. Consider the product type when choosing angles (e.g., shoes need side profiles, watches need wrist shots)

Background presets:
- studio-white: Clean white seamless backdrop, professional studio setup
- gradient: Smooth gradient background (light to dark or complementary colors)
- lifestyle: Natural environment context relevant to the product
- outdoor: Outdoor natural setting with ambient environment
- dark-moody: Dark dramatic backdrop with selective lighting

Lighting presets:
- soft: Soft diffused lighting, minimal shadows, even illumination
- dramatic: High contrast lighting with strong directional key light and deep shadows
- natural: Window light or natural daylight feel, organic shadows
- rim-light: Edge/rim lighting to separate product from background, backlit silhouette accent`;

// ============================================
// PROMPT BUILDER
// ============================================

/**
 * Build the user prompt from input data
 */
export function buildProductShotPrompt(input: ProductShotInput): string {
  const notesLine = input.additionalNotes
    ? `\nAdditional Notes: ${input.additionalNotes}`
    : '';

  return `Create a ${input.shotCount}-shot product photography plan for:

Product: ${input.productName}
Background: ${input.background}
Lighting: ${input.lighting}${notesLine}

Generate exactly ${input.shotCount} shots with diverse angles that best showcase this product for e-commerce and marketing use.`;
}
