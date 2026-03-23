/**
 * Video Recipe Registry
 *
 * Maps video recipe preset IDs to their recipe content.
 * Each recipe is XML-tagged instruction text injected into
 * the storyboard generator context when the user selects it.
 */

import { SEEDANCE_PRODUCT_RECIPE } from './seedance-product';
import { SEEDANCE_BEAUTY_RECIPE } from './seedance-beauty';
import { SEEDANCE_FOOD_RECIPE } from './seedance-food';
import { SEEDANCE_NARRATIVE_RECIPE } from './seedance-narrative';
import { KLING_ACTION_RECIPE } from './kling-action';
import { VEO_DIALOGUE_RECIPE } from './veo-dialogue';
import { UNIVERSAL_LUXURY_RECIPE } from './universal-luxury';

/** Metadata for each video recipe preset (for UI display) */
export interface VideoRecipePreset {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name */
  icon: string;
  /** Which model families this recipe works best with */
  modelAffinity: ('seedance' | 'kling' | 'veo')[];
  /** Approximate context cost in tokens */
  tokenCost: number;
}

/** All available video recipe presets */
export const VIDEO_RECIPE_PRESETS: VideoRecipePreset[] = [
  { id: 'seedance-product', label: 'Product Reveal', description: 'Float, rotate, break-out-of-frame', icon: 'Package', modelAffinity: ['seedance'], tokenCost: 1500 },
  { id: 'seedance-beauty', label: 'Beauty ASMR', description: 'Texture, glow, skincare routine', icon: 'Sparkles', modelAffinity: ['seedance'], tokenCost: 1500 },
  { id: 'seedance-food', label: 'Food Cinema', description: 'Macro pour, chef table, sizzle', icon: 'UtensilsCrossed', modelAffinity: ['seedance'], tokenCost: 1500 },
  { id: 'seedance-narrative', label: 'Narrative Arc', description: 'Morning ritual, transformation', icon: 'BookOpen', modelAffinity: ['seedance'], tokenCost: 1500 },
  { id: 'kling-action', label: 'Action Shots', description: 'Slow-mo, fast cuts, dynamic', icon: 'Zap', modelAffinity: ['kling'], tokenCost: 1500 },
  { id: 'veo-dialogue', label: 'Dialogue Scene', description: 'Lip-sync, conversation, voiceover', icon: 'MessageSquare', modelAffinity: ['veo'], tokenCost: 1500 },
  { id: 'universal-luxury', label: 'Luxury Editorial', description: 'Silent statement, editorial sweep', icon: 'Crown', modelAffinity: ['seedance', 'kling', 'veo'], tokenCost: 1200 },
];

/** Map of video recipe ID to recipe content string */
const VIDEO_RECIPE_MAP: Record<string, string> = {
  'seedance-product': SEEDANCE_PRODUCT_RECIPE,
  'seedance-beauty': SEEDANCE_BEAUTY_RECIPE,
  'seedance-food': SEEDANCE_FOOD_RECIPE,
  'seedance-narrative': SEEDANCE_NARRATIVE_RECIPE,
  'kling-action': KLING_ACTION_RECIPE,
  'veo-dialogue': VEO_DIALOGUE_RECIPE,
  'universal-luxury': UNIVERSAL_LUXURY_RECIPE,
};

/**
 * Load video recipe content for the given recipe IDs.
 * Returns concatenated XML-tagged recipe strings ready for injection.
 */
export function loadVideoRecipes(recipeIds: string[]): string {
  if (!recipeIds || recipeIds.length === 0) return '';

  const recipes: string[] = [];
  for (const id of recipeIds) {
    const recipe = VIDEO_RECIPE_MAP[id];
    if (recipe) {
      recipes.push(recipe.trim());
    }
  }

  if (recipes.length === 0) return '';

  return `<video-recipes>
The user selected these video recipe presets. Use these templates and tips when crafting video prompts for the storyboard scenes.
Follow the prompt structures closely — they are optimized for the target video model.

${recipes.join('\n\n')}
</video-recipes>`;
}

/**
 * Get a single video recipe by ID.
 */
export function getVideoRecipe(id: string): string | null {
  return VIDEO_RECIPE_MAP[id] || null;
}
