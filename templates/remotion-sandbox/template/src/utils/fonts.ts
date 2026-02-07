/**
 * Font loader utility — pre-loads premium fonts for all compositions.
 * Uses @remotion/google-fonts for reliable cross-platform rendering.
 */
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

// Load fonts and export family names
const inter = loadInter();
const jetbrains = loadJetBrainsMono();

export const fonts = {
  heading: inter.fontFamily,
  body: inter.fontFamily,
  mono: jetbrains.fontFamily,
} as const;

export { inter, jetbrains };
