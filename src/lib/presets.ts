import type { CharacterPreset, StylePreset, CameraAnglePreset, CameraLensPreset, CameraPreset } from './types';

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
    promptModifier: 'front-facing view, subject looking directly at camera, eye-level straight-on composition, symmetrical framing',
  },
  {
    id: 'three-quarter',
    label: '3/4 View',
    preview: '/assets/presets/camera-angles/three-quarter.svg',
    promptModifier: 'three-quarter angle view, face turned 45 degrees from camera, adds dimensional depth, classic portrait angle',
  },
  {
    id: 'side-profile',
    label: 'Side Profile',
    preview: '/assets/presets/camera-angles/side-profile.svg',
    promptModifier: 'side profile view, 90-degree angle to subject, clean silhouette line, dramatic profile composition',
  },
  {
    id: 'overhead',
    label: 'Overhead',
    preview: '/assets/presets/camera-angles/overhead.svg',
    promptModifier: 'overhead camera angle, shot from directly above subject, top-down flat lay perspective, reveals patterns and layout',
  },
  {
    id: 'low-angle',
    label: 'Low Angle',
    preview: '/assets/presets/camera-angles/low-angle.svg',
    promptModifier: 'low angle shot, camera below eye level looking upward, empowering heroic perspective, subject appears powerful and imposing',
  },
  {
    id: 'dutch-angle',
    label: 'Dutch Angle',
    preview: '/assets/presets/camera-angles/dutch-angle.svg',
    promptModifier: 'dutch angle tilted frame, rotated horizon line creating diagonal composition, dynamic tension, psychological unease, dramatic effect',
  },
  {
    id: 'birds-eye',
    label: "Bird's Eye",
    preview: '/assets/presets/camera-angles/birds-eye.svg',
    promptModifier: "bird's eye view, extreme high angle aerial perspective looking straight down, god's eye view, reveals spatial relationships and patterns",
  },
  {
    id: 'worms-eye',
    label: "Worm's Eye",
    preview: '/assets/presets/camera-angles/worms-eye.svg',
    promptModifier: "worm's eye view, extreme low angle shot from ground level looking up, towering dramatic scale, monumentalizes subject",
  },
];

// ============================================
// CAMERA LENS PRESETS
// ============================================
export const CAMERA_LENS_PRESETS: CameraLensPreset[] = [
  {
    id: 'wide-angle',
    label: 'Wide 24mm',
    preview: '/assets/presets/camera-lens/wide-angle.svg',
    promptModifier: 'shot with 24mm wide angle lens, expansive field of view, environmental context, slight barrel distortion at edges, dramatic perspective',
  },
  {
    id: 'standard',
    label: 'Standard 50mm',
    preview: '/assets/presets/camera-lens/standard.svg',
    promptModifier: 'shot with 50mm lens, natural perspective similar to human eye, balanced composition, no distortion, versatile framing',
  },
  {
    id: 'portrait',
    label: 'Portrait 85mm',
    preview: '/assets/presets/camera-lens/portrait.svg',
    promptModifier: 'shot with 85mm portrait lens, flattering facial proportions, creamy bokeh background blur, beautiful subject separation, shallow depth of field',
  },
  {
    id: 'telephoto',
    label: 'Telephoto 200mm',
    preview: '/assets/presets/camera-lens/telephoto.svg',
    promptModifier: 'shot with 200mm telephoto lens, compressed perspective, flattened background, strong background blur, distant subject isolation',
  },
  {
    id: 'macro',
    label: 'Macro',
    preview: '/assets/presets/camera-lens/macro.svg',
    promptModifier: 'macro lens extreme close-up, 1:1 magnification, incredible fine detail, paper-thin depth of field, reveals microscopic textures',
  },
  {
    id: 'fisheye',
    label: 'Fisheye',
    preview: '/assets/presets/camera-lens/fisheye.svg',
    promptModifier: 'shot with fisheye lens, 180-degree ultra-wide field of view, extreme barrel distortion, spherical warped perspective, dramatic and surreal',
  },
  {
    id: 'tilt-shift',
    label: 'Tilt-Shift',
    preview: '/assets/presets/camera-lens/tilt-shift.svg',
    promptModifier: 'shot with tilt-shift lens, selective plane of focus, miniature diorama effect, dreamy blur gradient, architectural perspective control',
  },
  {
    id: 'anamorphic',
    label: 'Anamorphic',
    preview: '/assets/presets/camera-lens/anamorphic.svg',
    promptModifier: 'shot with anamorphic lens, cinematic 2.39:1 widescreen look, horizontal lens flares, oval bokeh, Hollywood film aesthetic',
  },
];

// ============================================
// CAMERA PRESETS (Camera body types)
// ============================================
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'dslr',
    label: 'DSLR',
    preview: '/assets/presets/cameras/dslr.svg',
    promptModifier: 'shot on professional DSLR camera',
  },
  {
    id: 'mirrorless',
    label: 'Mirrorless',
    preview: '/assets/presets/cameras/mirrorless.svg',
    promptModifier: 'shot on mirrorless camera, sharp detail',
  },
  {
    id: 'film-slr',
    label: 'Film SLR',
    preview: '/assets/presets/cameras/film-slr.svg',
    promptModifier: 'shot on 35mm film camera, film grain, analog aesthetic',
  },
  {
    id: 'rangefinder',
    label: 'Rangefinder',
    preview: '/assets/presets/cameras/rangefinder.svg',
    promptModifier: 'shot on Leica rangefinder, classic street photography look',
  },
  {
    id: 'medium-format',
    label: 'Medium Format',
    preview: '/assets/presets/cameras/medium-format.svg',
    promptModifier: 'shot on medium format camera, high resolution, exceptional detail',
  },
  {
    id: 'cinema',
    label: 'Cinema',
    preview: '/assets/presets/cameras/cinema.svg',
    promptModifier: 'shot on cinema camera, cinematic look, movie quality',
  },
  {
    id: 'instant',
    label: 'Instant',
    preview: '/assets/presets/cameras/instant.svg',
    promptModifier: 'Polaroid instant photo, vintage border, nostalgic',
  },
  {
    id: 'compact',
    label: 'Compact',
    preview: '/assets/presets/cameras/compact.svg',
    promptModifier: 'shot on compact camera, casual street photography',
  },
];
