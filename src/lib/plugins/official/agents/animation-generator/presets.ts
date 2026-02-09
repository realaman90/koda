/**
 * Animation Generator Presets
 *
 * Style presets, font options, and output setting constants
 * for the AnimationSettingsPanel.
 */

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { title: string; body: string };
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean lines, generous whitespace',
    colors: { primary: '#09090B', secondary: '#FAFAFA', accent: '#3B82F6' },
    fonts: { title: 'Inter', body: 'Inter' },
  },
  {
    id: 'corporate',
    label: 'Corporate',
    description: 'Professional, polished, trustworthy',
    colors: { primary: '#0F172A', secondary: '#F8FAFC', accent: '#2563EB' },
    fonts: { title: 'Plus Jakarta Sans', body: 'DM Sans' },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High contrast, impactful, strong',
    colors: { primary: '#000000', secondary: '#FFFFFF', accent: '#EF4444' },
    fonts: { title: 'Montserrat', body: 'Roboto' },
  },
  {
    id: 'neon',
    label: 'Neon',
    description: 'Dark backgrounds, vibrant glows',
    colors: { primary: '#0A0A0B', secondary: '#1A1A2E', accent: '#00FF88' },
    fonts: { title: 'Space Grotesk', body: 'Inter' },
  },
  {
    id: 'retro',
    label: 'Retro',
    description: 'Warm tones, nostalgic feel',
    colors: { primary: '#1C1917', secondary: '#FEF3C7', accent: '#F59E0B' },
    fonts: { title: 'Playfair Display', body: 'DM Sans' },
  },
  {
    id: 'organic',
    label: 'Organic',
    description: 'Soft gradients, natural curves',
    colors: { primary: '#064E3B', secondary: '#ECFDF5', accent: '#10B981' },
    fonts: { title: 'Outfit', body: 'Poppins' },
  },
];

export const FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Poppins',
  'Space Grotesk',
  'Playfair Display',
  'DM Sans',
  'Plus Jakarta Sans',
  'Outfit',
  'JetBrains Mono',
] as const;

export const FPS_OPTIONS = [
  { value: 24, label: '24 fps' },
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
] as const;

export const RESOLUTION_OPTIONS = [
  { value: '720p' as const, label: '720p' },
  { value: '1080p' as const, label: '1080p' },
  { value: '4k' as const, label: '4K' },
] as const;
