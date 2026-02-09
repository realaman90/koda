/**
 * Animation Generator Presets
 *
 * Style presets (aesthetic direction + agent instructions),
 * Theme presets (color/font combos), font options, and output settings.
 */

// ─── Style Presets (aesthetic direction) ──────────────────────────────

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  /** Preview image path (relative to /assets/presets/animation-styles/) */
  image: string;
  /** Default color palette applied when this style is selected */
  colors: { primary: string; secondary: string; accent: string };
  /** Default fonts applied when this style is selected */
  fonts: { title: string; body: string };
  /** Specific instructions injected into the agent context when this style is selected */
  instructions: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean, restrained, whitespace-driven',
    image: '/assets/presets/animation-styles/minimal.jpg',
    colors: { primary: '#09090B', secondary: '#FAFAFA', accent: '#3B82F6' },
    fonts: { title: 'Inter', body: 'Inter' },
    instructions: `STYLE: Minimal
- Use generous whitespace and negative space as a design element
- Limit color palette to 2-3 colors max, prefer monochrome with one accent
- Typography should be clean sans-serif, use weight contrast (light vs bold) instead of color
- Animations should be subtle and understated: gentle fades, smooth slides, minimal easing
- Avoid decorative elements, gradients, glows, or particles — let content breathe
- Transitions: simple crossfades or slide-ins with long durations (800-1200ms)
- Spring configs: low stiffness (80-120), high damping (20-30) for buttery smooth motion
- Layout: centered, grid-aligned, generous padding (60-100px margins)
- If showing text: max 2 hierarchy levels, clean line spacing`,
  },
  {
    id: 'corporate',
    label: 'Corporate',
    description: 'Professional, polished, trustworthy',
    image: '/assets/presets/animation-styles/corporate.jpg',
    colors: { primary: '#0F172A', secondary: '#F8FAFC', accent: '#2563EB' },
    fonts: { title: 'Plus Jakarta Sans', body: 'DM Sans' },
    instructions: `STYLE: Corporate
- Professional and polished aesthetic — think Fortune 500 brand video
- Use structured layouts: grids, columns, clear visual hierarchy
- Color palette: deep blues, navy, slate with clean white backgrounds
- Typography: professional sans-serif fonts, clear headings, readable body text
- Animations: smooth and purposeful, no flashy effects — convey reliability
- Data visualizations welcome: charts, metrics, KPIs with animated reveals
- Transitions: horizontal slides, clean wipes, fade-ups with consistent timing
- Spring configs: medium stiffness (150-200), medium damping (15-20)
- Include subtle geometric patterns or line accents for visual interest
- Every element should feel intentional and aligned to a grid`,
  },
  {
    id: 'fashion',
    label: 'Fashion',
    description: 'Editorial, dramatic, high-end',
    image: '/assets/presets/animation-styles/fashion.jpg',
    colors: { primary: '#0C0A09', secondary: '#FAF9F6', accent: '#C2410C' },
    fonts: { title: 'Playfair Display', body: 'DM Sans' },
    instructions: `STYLE: Fashion / Editorial
- High-end editorial aesthetic — think Vogue, luxury brand campaign
- Bold typography as a visual element: oversized serif headers, dramatic kerning
- High contrast: deep blacks and bright whites, with selective pops of color
- Photography-centric: if images are provided, make them the hero with dramatic crops
- Animations: dramatic reveals, parallax scrolling effects, slow zoom-ins
- Use split-screen layouts, asymmetric compositions, overlapping elements
- Transitions: cinematic wipes, scale transitions, Ken Burns effect on images
- Spring configs: high stiffness (200-300) for snappy entrances, then ease to rest
- Textures welcome: grain overlays, subtle noise, vignettes for mood
- Typography animations: character-by-character reveals, staggered word entrances`,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Bold, energetic, conversion-focused',
    image: '/assets/presets/animation-styles/marketing.jpg',
    colors: { primary: '#1E1B4B', secondary: '#FFFFFF', accent: '#F97316' },
    fonts: { title: 'Montserrat', body: 'Poppins' },
    instructions: `STYLE: Marketing / Promotional
- Eye-catching and energetic — designed to grab attention in the first 2 seconds
- Bold, vibrant color palette with strong contrast for readability
- Large, impactful headlines — short punchy copy, not paragraphs
- Animated callouts: price badges, "NEW" tags, star ratings, social proof numbers
- Dynamic motion: bouncy entrances, scale pops, attention-grabbing pulses
- Spring configs: high stiffness (250-350), low damping (8-12) for bouncy overshoot
- Use gradient backgrounds, subtle particle effects, or radial glows for energy
- CTA elements should animate last and stand out with contrasting color
- Counter animations for metrics/stats (e.g., "10,000+" counting up)
- Fast-paced scene transitions (400-600ms), maintain energy throughout`,
  },
];

// ─── Theme Presets (color/font combos) ────────────────────────────────

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { title: string; body: string };
}

export const THEME_PRESETS: ThemePreset[] = [
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

// ─── Shared constants ─────────────────────────────────────────────────

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
