/**
 * Recipe Registry
 *
 * Maps technique preset IDs to their recipe content.
 * Each recipe is XML-tagged instruction text injected into
 * the code generator context when the user selects it.
 */

import { KINETIC_TYPOGRAPHY_RECIPE } from './kinetic-typography';
import { PARTICLE_SYSTEMS_RECIPE } from './particle-systems';
import { THREE_D_SCENES_RECIPE } from './3d-scenes';
import { DATA_VISUALIZATION_RECIPE } from './data-visualization';
import { PARALLAX_SCROLLING_RECIPE } from './parallax-scrolling';
import { MORPH_TRANSITIONS_RECIPE } from './morph-transitions';
import { GLITCH_DISTORTION_RECIPE } from './glitch-distortion';
import { CAMERA_MOVEMENTS_RECIPE } from './camera-movements';
import { LOGO_REVEALS_RECIPE } from './logo-reveals';
import { COMPOSITING_RECIPE } from './compositing';

/** Metadata for each technique preset (for UI display) */
export interface TechniquePreset {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name — rendered by the UI component */
  icon: string;
  /** Approximate context cost in tokens */
  tokenCost: number;
}

/** All available technique presets */
export const TECHNIQUE_PRESETS: TechniquePreset[] = [
  { id: 'kinetic-typography', label: 'Kinetic Typography', description: 'Word reveals, letter stagger, bounce text', icon: 'Type', tokenCost: 1500 },
  { id: 'particle-systems', label: 'Particles', description: 'Confetti, snow, sparks, ambient dust', icon: 'Sparkles', tokenCost: 2000 },
  { id: '3d-scenes', label: '3D Scenes', description: 'Three.js, cameras, lighting, materials', icon: 'Box', tokenCost: 2000 },
  { id: 'data-visualization', label: 'Data Viz', description: 'Charts, counters, progress rings', icon: 'BarChart3', tokenCost: 1500 },
  { id: 'parallax-scrolling', label: 'Parallax', description: 'Multi-layer depth, scroll effects', icon: 'Layers', tokenCost: 1000 },
  { id: 'morph-transitions', label: 'Morph', description: 'Shape morph, liquid, crossfades', icon: 'Blend', tokenCost: 1500 },
  { id: 'glitch-distortion', label: 'Glitch', description: 'RGB split, scan lines, CRT, noise', icon: 'Zap', tokenCost: 1500 },
  { id: 'camera-movements', label: 'Camera', description: 'Dolly, crane, shake, tracking', icon: 'Clapperboard', tokenCost: 1000 },
  { id: 'logo-reveals', label: 'Logo Reveal', description: 'Mask wipe, particle assemble, draw-on', icon: 'Aperture', tokenCost: 1500 },
  { id: 'compositing', label: 'Compositing', description: 'Blend modes, masks, light leaks', icon: 'SunMoon', tokenCost: 1500 },
];

/** Map of technique ID → recipe content string */
const RECIPE_MAP: Record<string, string> = {
  'kinetic-typography': KINETIC_TYPOGRAPHY_RECIPE,
  'particle-systems': PARTICLE_SYSTEMS_RECIPE,
  '3d-scenes': THREE_D_SCENES_RECIPE,
  'data-visualization': DATA_VISUALIZATION_RECIPE,
  'parallax-scrolling': PARALLAX_SCROLLING_RECIPE,
  'morph-transitions': MORPH_TRANSITIONS_RECIPE,
  'glitch-distortion': GLITCH_DISTORTION_RECIPE,
  'camera-movements': CAMERA_MOVEMENTS_RECIPE,
  'logo-reveals': LOGO_REVEALS_RECIPE,
  'compositing': COMPOSITING_RECIPE,
};

/**
 * Load recipe content for the given technique IDs.
 * Returns concatenated XML-tagged recipe strings ready for injection
 * into the code generator context.
 *
 * Returns empty string if no techniques are selected.
 */
export function loadRecipes(techniqueIds: string[]): string {
  if (!techniqueIds || techniqueIds.length === 0) return '';

  const recipes: string[] = [];
  for (const id of techniqueIds) {
    const recipe = RECIPE_MAP[id];
    if (recipe) {
      recipes.push(recipe.trim());
    }
  }

  if (recipes.length === 0) return '';

  return `<technique-recipes>
The user selected these technique presets. Use these patterns and tips in your code generation.
Follow the code patterns closely — they are tested and working.

${recipes.join('\n\n')}
</technique-recipes>`;
}

/**
 * Get a single recipe by ID.
 */
export function getRecipe(id: string): string | null {
  return RECIPE_MAP[id] || null;
}
