/**
 * Prompt Studio Recipe Registry
 *
 * Maps prompt preset IDs to their recipe content.
 * Each recipe is XML-tagged instruction text injected into
 * the Prompt Studio agent context when the user selects it.
 *
 * Follows the same pattern as animation technique recipes
 * (see ../index.ts for the animation equivalent).
 */

import { SEEDANCE_CINEMATIC_RECIPE } from './seedance-cinematic';
import { SEEDANCE_COMMERCIAL_RECIPE } from './seedance-commercial';
import { SEEDANCE_VIRAL_RECIPE } from './seedance-viral';
import { SEEDANCE_ANIME_RECIPE } from './seedance-anime';
import { NANOBANANA_PHOTOREALISM_RECIPE } from './nanobanana-photorealism';
import { NANOBANANA_PRODUCT_RECIPE } from './nanobanana-product';
import { NANOBANANA_CREATIVE_RECIPE } from './nanobanana-creative';

/** Metadata for each prompt preset (for UI display) */
export interface PromptPreset {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name — rendered by the UI component */
  icon: string;
  /** Category for grouping: 'video' or 'image' */
  category: 'video' | 'image';
  /** Approximate context cost in tokens */
  tokenCost: number;
}

/** All available prompt presets */
export const PROMPT_PRESETS: PromptPreset[] = [
  // ── Video (Seedance-style) ──
  { id: 'seedance-cinematic', label: 'Cinematic', description: 'Shot-by-shot breakdowns, director styles', icon: 'Clapperboard', category: 'video', tokenCost: 1800 },
  { id: 'seedance-commercial', label: 'Commercial', description: 'Product videos, brand campaigns', icon: 'Megaphone', category: 'video', tokenCost: 1500 },
  { id: 'seedance-viral', label: 'Viral / Meme', description: 'Surreal comedy, social media hooks', icon: 'Flame', category: 'video', tokenCost: 1500 },
  { id: 'seedance-anime', label: 'Anime / Art', description: 'Battles, painterly, mecha, VFX', icon: 'Sword', category: 'video', tokenCost: 1600 },

  // ── Image (NanoBanana-style) ──
  { id: 'nanobanana-photorealism', label: 'Photorealism', description: 'Pro camera specs, lens, ISO, film stock', icon: 'Camera', category: 'image', tokenCost: 2000 },
  { id: 'nanobanana-product', label: 'Product Shot', description: 'E-commerce, luxury, food, fashion', icon: 'ShoppingBag', category: 'image', tokenCost: 1600 },
  { id: 'nanobanana-creative', label: 'Creative', description: 'Droste, double exposure, film emulation', icon: 'Wand2', category: 'image', tokenCost: 1600 },
];

/** Map of preset ID → recipe content string */
const PROMPT_RECIPE_MAP: Record<string, string> = {
  'seedance-cinematic': SEEDANCE_CINEMATIC_RECIPE,
  'seedance-commercial': SEEDANCE_COMMERCIAL_RECIPE,
  'seedance-viral': SEEDANCE_VIRAL_RECIPE,
  'seedance-anime': SEEDANCE_ANIME_RECIPE,
  'nanobanana-photorealism': NANOBANANA_PHOTOREALISM_RECIPE,
  'nanobanana-product': NANOBANANA_PRODUCT_RECIPE,
  'nanobanana-creative': NANOBANANA_CREATIVE_RECIPE,
};

/**
 * Load recipe content for the given prompt preset IDs.
 * Returns concatenated XML-tagged recipe strings ready for injection
 * into the Prompt Studio agent context.
 *
 * Returns empty string if no presets are selected.
 */
export function loadPromptRecipes(presetIds: string[]): string {
  if (!presetIds || presetIds.length === 0) return '';

  const recipes: string[] = [];
  for (const id of presetIds) {
    const recipe = PROMPT_RECIPE_MAP[id];
    if (recipe) {
      recipes.push(recipe.trim());
    }
  }

  if (recipes.length === 0) return '';

  return `<prompt-style-recipes>
The user selected these style presets. Use these patterns, structures, and techniques in your prompt generation.
Follow the prompt formats closely — they produce superior results with the target models.

${recipes.join('\n\n')}
</prompt-style-recipes>`;
}

/**
 * Get a single recipe by ID.
 */
export function getPromptRecipe(id: string): string | null {
  return PROMPT_RECIPE_MAP[id] || null;
}
