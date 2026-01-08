import type { CharacterPreset, StylePreset, CameraAnglePreset, CameraLensPreset } from './types';

// ============================================
// CHARACTER PRESETS
// ============================================
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'marcus',
    label: 'Marcus',
    preview: '/assets/presets/characters/marcus.svg',
    promptModifier: 'Marcus, a confident businessman in his 40s wearing a tailored navy suit',
    type: 'preset',
  },
  {
    id: 'sofia',
    label: 'Sofia',
    preview: '/assets/presets/characters/sofia.svg',
    promptModifier: 'Sofia, a young woman in her 20s with casual style, wearing a cozy sweater',
    type: 'preset',
  },
  {
    id: 'victoria',
    label: 'Victoria',
    preview: '/assets/presets/characters/victoria.svg',
    promptModifier: 'Victoria, an elegant sophisticated woman in her 30s, formal black dress',
    type: 'preset',
  },
  {
    id: 'kai',
    label: 'Kai',
    preview: '/assets/presets/characters/kai.svg',
    promptModifier: 'Kai, a creative artist in his 30s, modern streetwear, expressive pose',
    type: 'preset',
  },
  {
    id: 'luna',
    label: 'Luna',
    preview: '/assets/presets/characters/luna.svg',
    promptModifier: 'Luna, a cheerful 8-year-old girl with bright smile, playful expression',
    type: 'preset',
  },
  {
    id: 'eleanor',
    label: 'Eleanor',
    preview: '/assets/presets/characters/eleanor.svg',
    promptModifier: 'Eleanor, a wise elderly woman in her 70s, silver hair, warm smile',
    type: 'preset',
  },
  {
    id: 'jordan',
    label: 'Jordan',
    preview: '/assets/presets/characters/jordan.svg',
    promptModifier: 'Jordan, an athletic person in sportswear, confident stance, fit physique',
    type: 'preset',
  },
  {
    id: 'dr-chen',
    label: 'Dr. Chen',
    preview: '/assets/presets/characters/dr-chen.svg',
    promptModifier: 'Dr. Chen, a scientist in white lab coat, glasses, intellectual appearance',
    type: 'preset',
  },
];

// ============================================
// STYLE PRESETS
// ============================================
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    preview: '/assets/presets/styles/cinematic.svg',
    promptModifier: 'cinematic lighting, movie still, dramatic shadows, film grain',
  },
  {
    id: 'anime',
    label: 'Anime',
    preview: '/assets/presets/styles/anime.svg',
    promptModifier: 'anime style, vibrant colors, clean lines, Japanese animation',
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    preview: '/assets/presets/styles/watercolor.svg',
    promptModifier: 'watercolor painting, soft edges, artistic, flowing colors',
  },
  {
    id: 'oil-painting',
    label: 'Oil Painting',
    preview: '/assets/presets/styles/oil-painting.svg',
    promptModifier: 'oil painting, textured brushstrokes, classical art style',
  },
  {
    id: 'pencil-sketch',
    label: 'Pencil Sketch',
    preview: '/assets/presets/styles/pencil-sketch.svg',
    promptModifier: 'pencil sketch, detailed drawing, graphite art, hand-drawn',
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    preview: '/assets/presets/styles/cyberpunk.svg',
    promptModifier: 'cyberpunk aesthetic, neon lights, futuristic, high-tech',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    preview: '/assets/presets/styles/vintage.svg',
    promptModifier: 'vintage photograph, retro aesthetic, film grain, nostalgic',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    preview: '/assets/presets/styles/minimalist.svg',
    promptModifier: 'minimalist design, clean composition, simple, elegant',
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    preview: '/assets/presets/styles/fantasy.svg',
    promptModifier: 'fantasy art style, magical, ethereal lighting, dreamlike',
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    preview: '/assets/presets/styles/photorealistic.svg',
    promptModifier: 'photorealistic, ultra-detailed, professional photography',
  },
  {
    id: 'comic-book',
    label: 'Comic Book',
    preview: '/assets/presets/styles/comic-book.svg',
    promptModifier: 'comic book style, bold outlines, halftone dots, dynamic',
  },
  {
    id: 'impressionist',
    label: 'Impressionist',
    preview: '/assets/presets/styles/impressionist.svg',
    promptModifier: 'impressionist painting, visible brushstrokes, light and color',
  },
];

// ============================================
// CAMERA ANGLE PRESETS
// ============================================
export const CAMERA_ANGLE_PRESETS: CameraAnglePreset[] = [
  {
    id: 'front',
    label: 'Front View',
    preview: '/assets/presets/camera-angles/front.svg',
    promptModifier: 'front view, looking at camera, straight on',
  },
  {
    id: 'three-quarter',
    label: '3/4 View',
    preview: '/assets/presets/camera-angles/three-quarter.svg',
    promptModifier: 'three-quarter view, slightly turned, angled perspective',
  },
  {
    id: 'side-profile',
    label: 'Side Profile',
    preview: '/assets/presets/camera-angles/side-profile.svg',
    promptModifier: 'side profile view, profile shot, 90 degree angle',
  },
  {
    id: 'overhead',
    label: 'Overhead',
    preview: '/assets/presets/camera-angles/overhead.svg',
    promptModifier: 'overhead shot, top-down view, looking down',
  },
  {
    id: 'low-angle',
    label: 'Low Angle',
    preview: '/assets/presets/camera-angles/low-angle.svg',
    promptModifier: 'low angle shot, looking up, heroic perspective, powerful',
  },
  {
    id: 'dutch-angle',
    label: 'Dutch Angle',
    preview: '/assets/presets/camera-angles/dutch-angle.svg',
    promptModifier: 'dutch angle, tilted frame, dynamic, dramatic',
  },
  {
    id: 'birds-eye',
    label: "Bird's Eye",
    preview: '/assets/presets/camera-angles/birds-eye.svg',
    promptModifier: "bird's eye view, aerial perspective, from above",
  },
  {
    id: 'worms-eye',
    label: "Worm's Eye",
    preview: '/assets/presets/camera-angles/worms-eye.svg',
    promptModifier: "worm's eye view, extreme low angle, ground level",
  },
];

// ============================================
// CAMERA LENS PRESETS
// ============================================
export const CAMERA_LENS_PRESETS: CameraLensPreset[] = [
  {
    id: 'wide-angle',
    label: 'Wide Angle',
    preview: '/assets/presets/camera-lens/wide-angle.svg',
    promptModifier: 'wide angle lens, 24mm, expansive view, distorted edges',
  },
  {
    id: 'standard',
    label: 'Standard 50mm',
    preview: '/assets/presets/camera-lens/standard.svg',
    promptModifier: '50mm lens, natural perspective, standard field of view',
  },
  {
    id: 'telephoto',
    label: 'Telephoto',
    preview: '/assets/presets/camera-lens/telephoto.svg',
    promptModifier: 'telephoto lens, 85mm, compressed background, shallow depth of field',
  },
  {
    id: 'macro',
    label: 'Macro',
    preview: '/assets/presets/camera-lens/macro.svg',
    promptModifier: 'macro photography, extreme close-up, detailed, magnified',
  },
  {
    id: 'fisheye',
    label: 'Fisheye',
    preview: '/assets/presets/camera-lens/fisheye.svg',
    promptModifier: 'fisheye lens, distorted perspective, ultra-wide, spherical',
  },
  {
    id: 'tilt-shift',
    label: 'Tilt-Shift',
    preview: '/assets/presets/camera-lens/tilt-shift.svg',
    promptModifier: 'tilt-shift lens, miniature effect, selective focus, toy-like',
  },
  {
    id: 'portrait',
    label: 'Portrait 85mm',
    preview: '/assets/presets/camera-lens/portrait.svg',
    promptModifier: '85mm portrait lens, beautiful bokeh, subject isolation',
  },
  {
    id: 'anamorphic',
    label: 'Anamorphic',
    preview: '/assets/presets/camera-lens/anamorphic.svg',
    promptModifier: 'anamorphic lens, cinematic, lens flares, oval bokeh',
  },
];
