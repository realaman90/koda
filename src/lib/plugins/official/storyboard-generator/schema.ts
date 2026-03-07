/**
 * Storyboard Generator Schema
 *
 * Zod schemas for input validation and AI output structure.
 * System prompts, model-aware prompt profiles, and prompt builders.
 */

import { z } from 'zod';

// ============================================
// VIDEO MODEL FAMILIES
// ============================================

export const VIDEO_MODEL_FAMILIES = ['veo', 'kling', 'seedance'] as const;
export type VideoModelFamily = (typeof VIDEO_MODEL_FAMILIES)[number];

export function normalizeStoryboardVideoModelFamily(
  targetVideoModel: VideoModelFamily = 'veo'
): VideoModelFamily {
  return targetVideoModel === 'seedance' ? 'kling' : targetVideoModel;
}

// ============================================
// INPUT SCHEMA (Client -> API)
// ============================================

/**
 * Input validation schema for storyboard generation
 */
/** Single reference entry in the N-ref input */
const StoryboardReferenceInputSchema = z.object({
  id: z.string(),
  role: z.enum(['subject', 'character', 'prop', 'environment']),
  label: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
});

export const StoryboardInputSchema = z.object({
  /** Dynamic references list (N-ref support) */
  references: z.array(StoryboardReferenceInputSchema).optional(),
  /** @deprecated Use references instead */
  product: z.string().optional(),
  /** @deprecated Use references instead */
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
  /** Storyboard mode: 'transition' for video transitions between scenes, 'single-shot' for independent scene videos */
  mode: z.enum(['transition', 'single-shot']).default('transition'),
  /** Target video model family for prompt optimization */
  targetVideoModel: z.enum(VIDEO_MODEL_FAMILIES).default('veo'),
  /** Optional video recipe IDs for style guidance */
  videoRecipes: z.array(z.string()).optional(),
  /** @deprecated Use references[].imageUrl instead */
  productImageUrl: z.string().optional(),
  /** @deprecated Use references[].imageUrl instead */
  characterImageUrl: z.string().optional(),
});

export type StoryboardInput = z.infer<typeof StoryboardInputSchema>;

// ============================================
// OUTPUT SCHEMA (AI -> Client)
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
  /** Detailed image generation prompt (structured, min 80 chars) */
  prompt: z.string().min(1),
  /** Camera direction/angle */
  camera: z.string(),
  /** Mood/atmosphere */
  mood: z.string(),
  /** Video transition prompt describing motion from this scene to the next (transition mode only, optional for last scene) */
  transition: z.string().optional(),
  /** Video motion prompt describing action within this scene (single-shot mode only) */
  motion: z.string().optional(),
  /** Negative prompt — what to exclude from generation */
  negativePrompt: z.string().optional(),
  /** Audio direction — SFX, ambient, dialogue cues */
  audioDirection: z.string().optional(),
  /** Video aspect ratio chosen by agent based on content and model */
  videoAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']).optional(),
  /** Video duration in seconds chosen by agent based on action complexity and model limits */
  videoDuration: z.coerce.number().optional(),
  /** Which reference IDs appear in this scene (AI-decided, N-ref support) */
  referenceIds: z.array(z.string()).optional(),
});

export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

/**
 * Complete storyboard output from AI
 */
/** AI-generated identity for a single reference */
const StoryboardReferenceIdentitySchema = z.object({
  refId: z.string(),
  label: z.string(),
  role: z.enum(['subject', 'character', 'prop', 'environment']),
  identity: z.string(),
});

export const StoryboardOutputSchema = z.object({
  /** Array of scenes */
  scenes: z.array(StoryboardSceneSchema),
  /** Brief summary of the storyboard */
  summary: z.string(),
  /** @deprecated Use referenceIdentities instead */
  productIdentity: z.string().optional(),
  /** @deprecated Use referenceIdentities instead */
  characterIdentity: z.string().optional(),
  /** AI-generated identities for each reference (N-ref support) */
  referenceIdentities: z.array(StoryboardReferenceIdentitySchema).optional(),
});

export type StoryboardOutput = z.infer<typeof StoryboardOutputSchema>;

// ============================================
// MODEL-AWARE VIDEO PROMPT PROFILES (#69)
// ============================================

export interface VideoPromptProfile {
  maxWords: number;
  structure: string;
  /** Prompt formula for this model */
  formula: string;
  /** Mode-specific tips (T2V = text-to-video, I2V = image-to-video, R2V = reference-to-video) */
  modes: { t2v: string; i2v: string; r2v?: string };
  imagePromptTips: string[];
  videoPromptTips: string[];
  /** Audio-related keywords and syntax */
  audioKeywords: string;
  /** Supported duration range */
  durationRange: string;
  /** Exact valid duration values in seconds */
  validDurations: number[];
  /** Default duration in seconds */
  defaultDuration: number;
  /** Supported aspect ratios */
  aspectRatios: string[];
  /** Reference image capabilities */
  referenceCapabilities: string;
  exampleImagePrompt: string;
  exampleTransition: string;
  exampleMotion: string;
  negativePromptTips: string;
}

export const VIDEO_PROMPT_PROFILES: Record<VideoModelFamily, VideoPromptProfile> = {
  veo: {
    maxWords: 60,
    structure: '[Shot type] [Subject with identity] [Action + physics], [Setting + atmosphere], [Lighting]. For dialogue: Character says: line (colon format, NO quotation marks — quotes trigger subtitles). For audio: specify ambient sounds explicitly or Veo hallucinates studio laughter.',
    formula: '[Camera] + [Subject] + [Action] + [Setting] + [Style & Audio]',
    modes: {
      t2v: 'Full prose description. Specify all audio explicitly — dialogue via says: format, SFX via description, ambient sounds clearly stated. Add (no subtitles) if no dialogue.',
      i2v: 'Reference image anchors visuals. Prompt describes motion and audio only.',
      r2v: 'Repeat identical character descriptions across scenes for consistency (scene bible approach).',
    },
    imagePromptTips: [
      'Detail drives results — the more specific, the more control over output',
      'Specify shot type, lens, and depth of field explicitly',
      'Include lighting direction and color temperature',
      'Ensure subjects are in poses that naturally transition to motion (these become video keyframes)',
      'Mention style references: film noir, VHS aesthetic, claymation, etc.',
    ],
    videoPromptTips: [
      'Describe the motion journey, NOT the static endpoints',
      'Dialogue: use colon format — "Character says: line" — NEVER use quotation marks (they trigger subtitles)',
      'Add (no subtitles) at end of prompt if no dialogue is intended',
      'Specify ambient sounds explicitly or Veo hallucinates studio audience laughter',
      'Keep dialogue short — approximately 8 seconds worth. Overloaded dialogue sounds rushed and unnatural',
      'Spell words phonetically if mispronounced (e.g., "Shreedar" not "Shridar")',
      'Camera terms: dolly, tracking, crane/jib, pan, tilt, orbit, zoom in/out, eye level, worms eye',
      'One primary camera movement per prompt — do NOT stack competing moves',
      'Character consistency: use identical descriptive language across all scenes',
      'Keep prompts 40-60 words, 3-4 sentences',
    ],
    audioKeywords: 'Dialogue: use says: format (NO quotes — quotes trigger subtitles). Audio prefixes: "SFX: door creaks, glass clinks", "Ambient: cafe chatter, rain on window". Always end with (no subtitles) if no dialogue. Veo generates native audio in a single pass.',
    durationRange: '5s / 6s / 8s',
    validDurations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16'],
    referenceCapabilities: 'Character consistency via scene bible (repeat identical descriptions). Same prompt + different seed = visually similar results.',
    exampleImagePrompt: 'Close-up with shallow depth of field, 35mm lens. A young woman with auburn hair holds a matte black ceramic mug with gold rim, steam rising from the surface. Golden hour light streams through rain-streaked cafe windows, casting warm amber tones across her face. Cinematic color grading, soft bokeh background.',
    exampleTransition: 'Slow dolly in as she raises the matte black ceramic mug with gold rim to her lips, steam curling upward and catching the golden backlight. Her eyes close as she takes the first sip. SFX: ceramic on wood. Ambient: gentle coffee shop murmur, soft jazz. (no subtitles)',
    exampleMotion: 'She lifts the matte black ceramic mug with gold rim with both hands, steam rising and swirling in the warm backlight. Camera holds steady with subtle push-in, shallow depth of field keeping focus on her expression. Ambient: cafe chatter, ceramic on wood. (no subtitles)',
    negativePromptTips: 'motion blur, face distortion, warping, morphing, duplicate limbs, text overlay, subtitles',
  },
  kling: {
    maxWords: 50,
    structure: '[Shot type] of [subject] [action/movement], [environment/setting], [camera movement], [lighting/mood], [style]. Write as if describing the scene to a person. Always specify a clear END STATE for every motion.',
    formula: '[Shot type] + [Subject] + [Action → End State] + [Environment] + [Camera movement] + [Lighting/mood] + [Style]',
    modes: {
      t2v: 'Full text prompt. Write naturally. Use temporal markers: "initially... then... finally". Always specify end state.',
      i2v: 'Reference image as start frame. Prompt describes motion from that frame forward. End state prevents 99% hang.',
    },
    imagePromptTips: [
      'Use natural language — write as you would describe the scene to a person',
      'Keep descriptions concrete and action-oriented, not abstract',
      'Avoid specifying exact counts of objects (model struggles with this)',
      'Include one clear visual anchor — do not overload the frame',
      'Describe foreground, midground, background as separate depth layers',
    ],
    videoPromptTips: [
      'CRITICAL: Always give motion a clear END STATE describing the final frame — without it, generation hangs at 99%. Example: "...ending with the shoe centered in frame, paint frozen mid-air"',
      'Use temporal markers: "initially... then... finally" for multi-step motion',
      'Pair every camera movement with a target: "camera slowly dollies forward toward the dish" not just "dolly in"',
      'Keep to 1-3 actions maximum per shot',
      'Kling supports ++emphasis++ weighting: "++water droplets explode++ from each footstrike" — use sparingly, 1-2 per prompt max',
      'Speed descriptors: gracefully, swiftly, gradually, explosively, smoothly, rhythmically',
      'Camera: dolly, tracking, crane/jib, pan, tilt, orbit, handheld, steadicam',
      'Advanced combos: dolly zoom ("dolly out with zoom in"), arc track, crane pan, push-in tilt',
      'Reduce complexity if distortion appears — simultaneous transformations cause warped geometry',
      'Keep prompts 30-50 words, concise and direct',
      'Product must remain identifiable throughout — always describe it with exact attributes in the motion prompt',
    ],
    audioKeywords: 'No native audio generation. Focus entirely on visual action, physics, and camera movement.',
    durationRange: '5s / 10s',
    validDurations: [5, 10, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    referenceCapabilities: 'Single reference image as start frame (I2V). 1080p at 30fps output.',
    exampleImagePrompt: 'Medium shot of a young woman with auburn hair in a leather jacket sitting at a wooden cafe table, both hands wrapped around a matte black ceramic mug with gold rim. Warm pendant lights overhead, steam rising from the cup. Shallow depth of field, cinematic color grading, warm amber tones.',
    exampleTransition: 'Camera tracks alongside as she lifts the matte black ceramic mug with gold rim from the table and takes a slow sip, then gently sets it back down on the saucer. Her eyes shift from the mug to the rain-streaked window. Ending with the mug centered on the saucer, steam rising, her gaze fixed on the window. Warm overhead lighting.',
    exampleMotion: 'She picks up the matte black ceramic mug with gold rim and takes a deliberate sip, then sets it down with a soft clink on the saucer. Camera holds steady at medium close-up. Ending with steam gradually dissipating, mug resting on saucer, her fingers still curled around the handle.',
    negativePromptTips: 'blur, distortion, watermark, text overlay, low quality, compression artifacts, flickering, inconsistent lighting, morphing faces, extra limbs, unnatural physics',
  },
  seedance: {
    maxWords: 80,
    structure: '7-part formula in order: (1) Opening shot + angle — camera position, lens feel, framing. (2) Subject + clothing detail — who/what is in frame with specific visual details (color, texture, material). (3) Action sequence — what happens, described as a director would call it. (4) Micro-physics detail — the small physical truths that make it real (condensation droplets, fabric stretching under force, specular highlights traveling across surface). (5) Camera movement — how the camera moves (millimetre-slow push-in, snap-cut, holds completely static). (6) Audio cue — describe the sound Seedance generates natively (pure ASMR no music, single crisp chime, cinematic percussion builds). (7) Emotional arc — the feeling the last frame should leave (confident unhurried, the viewer feels it before they buy it).',
    formula: '[Opening shot + angle] + [Subject + detail] + [Action] + [Micro-physics] + [Camera movement] + [Audio cue] + [Emotional arc]',
    modes: {
      t2v: 'Full scene from scratch. Follow the 7-part formula. Pin subject in first 20 words. Describe audio explicitly — Seedance generates native audio in one pass.',
      i2v: 'One reference image + text prompt. Seedance animates the image. Prompt adds motion, camera, audio. Use @image1 reference.',
      r2v: 'Multimodal: up to 9 images + 3 videos (≤15s) + 3 audio files + text. Isolate reference roles explicitly: "@image1 for face only — do not use clothing or background from it", "@image2 for product", "@video1 for camera movement only, replicate the dolly path and easing", "@audio1 for music tone and energy".',
    },
    imagePromptTips: [
      'Pin the main subject AND product in the first 20 words — critical for Seedance consistency',
      'Include specific visual details: color, texture, material, not just "a nice product"',
      'Structure: Subject, Camera, Lighting, Style as separate concepts',
      'Pick ONE visual style anchor (not six adjectives)',
      'Short prompts (30-80 words) consistently outperform long ones',
    ],
    videoPromptTips: [
      'Follow the 7-part formula: shot+angle → subject+detail → action → micro-physics → camera movement → audio cue → emotional arc',
      'ALWAYS name the micro-physics: "specular highlight travels across surface" beats "it looks shiny". "Condensation droplets race down glass" beats "cold drink"',
      'Camera pace language matters: "millimetre-slow push-in", "never stops moving", "holds completely static" all produce distinct results',
      'Audio first mindset: describe the sound before worrying about music. "Near-silence — only faintest ambient hum, then a single soft chime" is a complete audio brief',
      'End with the emotional arc — always close the prompt with the feeling, not just the visual action',
      'ONE shot, ONE verb — multiple motion verbs in a single shot confuse the model',
      'Multi-shot in one generation: "3-shot sequence: (1)... (2)... (3)..." or "cut on action between panels" — a single 15s gen can contain multiple shots with natural cuts',
      'Physics keywords trigger motion priors: float, shatter, ripple, dissolve, levitate, scatter, implode, stretch, compress',
      'Pin subject AND product in first 20 words or consistency breaks',
      'Limit to 1-2 characters — more causes identity confusion',
      'For R2V, describe each reference\'s role explicitly — the model can isolate attributes (face vs clothing vs background) if you tell it to',
      'Does NOT support negative prompts — use positive constraints: "maintain consistency, no distortion"',
      'Product must be described with EXACT attributes in every prompt — never abbreviate or change product details',
    ],
    audioKeywords: 'Native audio generation in one pass — music, dialogue, ASMR textures, ambient sound, SFX all generated together. Design sound explicitly: "pure ASMR: soft jar-open click, muffled product compress, fingertip friction, no music" or "cinematic percussion builds to single crisp chime". Keywords: reverb, muffled, echoing, metallic clink, crunchy, high-pitched, crackling fire. Use @audio1 for audio reference in R2V mode.',
    durationRange: '5s / 10s / 15s',
    validDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16'],
    referenceCapabilities: 'R2V: up to 9 images + 3 videos (≤15s) + 3 audio files. @image1 for character face (isolate: "face only, not clothing"), @image2 for environment mood, @image3 for product. @video1 for camera movement replication. @audio1 for music tone. Can isolate specific attributes from references. Character consistency maintained across all shots in R2V mode — same face, clothing, style from @image1.',
    exampleImagePrompt: 'A young woman with auburn hair in a leather jacket holds a matte black ceramic mug with gold rim at a wooden cafe table. Camera: medium close-up, eye-level. Soft warm pendant lighting from above, shallow depth of field. Cinematic style, warm amber tones.',
    exampleTransition: 'Low-angle tracking shot. Woman with auburn hair in leather jacket lifts matte black ceramic mug with gold rim toward her lips. Translucent steam curls catch amber backlight; condensation droplets visible on ceramic surface. Millimetre-slow dolly in, gimbal-stabilized. Pure ASMR: soft ceramic scrape on wood, faint liquid movement, no music. Intimate and unhurried — the viewer feels the warmth before seeing the sip.',
    exampleMotion: 'Immersive first-person POV, extreme close-up macro lens. Hands slowly lift matte black ceramic mug with gold rim from wooden saucer. Specular highlights travel across the gold rim; micro steam particles rise and dissipate in warm amber soft-box lighting. Camera stays locked with slight micro-movement. Pure ASMR: soft ceramic-on-wood scrape, muffled liquid shift, fingertip friction on matte surface, no music. Sensory and meditative — the viewer feels the product before buying.',
    negativePromptTips: 'Does NOT support negative prompts. Use positive constraints instead: "maintain face and clothing consistency, no distortion, high detail, stable picture, no blur, no ghosting, no flickering"',
  },
};

// ============================================
// SYSTEM PROMPTS (Mode + Model Aware)
// ============================================

/**
 * Base guidelines for all storyboard generation
 */
const STORYBOARD_BASE_GUIDELINES = `You are an expert storyboard artist and creative director specializing in visual storytelling for advertising and content creation.

Your task is to break down a concept into a series of scenes optimized for AI image generation and AI video generation.

CRITICAL: These images will be used as VIDEO KEYFRAMES. Ensure subjects are in poses that can naturally transition to motion. Prefer compositions with clear foreground/background separation. Avoid extreme close-ups that leave no room for camera movement.

IDENTITY CONSISTENCY (MANDATORY):
References are the STARS of every scene. They must be prominently featured, visually dominant, and NEVER lose focus.

REFERENCE IDENTITIES (MANDATORY):
For EACH reference provided in the input, generate a "referenceIdentities" array entry with:
- refId: echo the reference's id EXACTLY as given
- label: echo from input
- role: echo from input
- identity: a detailed visual identity description

For SUBJECT/PROP references: exact physical attributes (color, material, shape, size, texture, finish, brand markings). Example: "matte black ceramic mug with thin gold rim, 12oz, cylindrical, smooth finish". NEVER change these attributes across scenes.
For CHARACTER references: physical appearance ONLY (age, gender, ethnicity, hair color/length/style, facial features, body type, clothing, accessories). Do NOT describe personality or emotions — only what a camera would see. Example: "woman, early 30s, East Asian, black chin-length bob, slim build, cream turtleneck sweater, small gold hoop earrings".
For ENVIRONMENT references: visual signature (architecture, palette, lighting, notable features).

If ANY human character appears in the scenes — whether explicitly listed as a reference OR implied by the concept — you MUST ensure a character reference identity exists. Without it, each scene generates a different-looking person.

REFERENCE IMAGES:
When reference images are attached to the message, you MUST study them carefully and derive identity descriptions from what you SEE in the image — not from text descriptions alone. The image is the SOURCE OF TRUTH. If the image shows a sage green windbreaker, do NOT write "slate-grey jacket". Describe the EXACT visual details. If both an image and text description are provided, the IMAGE takes priority.

Also generate legacy fields for backward compatibility:
- "productIdentity": copy the identity of the first subject/prop reference (if any)
- "characterIdentity": copy the identity of the first character reference (if any)

PER-SCENE REFERENCE ASSIGNMENT:
Each scene MUST include a "referenceIds" array listing which reference IDs appear in that scene.
Only include identities VERBATIM in a scene's prompt for references that appear in that scene.

PLACEMENT ORDER in every scene prompt:
1. CHARACTER identities (verbatim) — for characters in this scene
2. SUBJECT/PROP identities (verbatim) — for objects in this scene
3. Scene-specific action, setting, camera, lighting

For each scene, provide:

- **title**: A short, descriptive title (2-5 words)

- **description**: What happens in this scene (1-2 sentences)

- **prompt**: A detailed image generation prompt using this STRUCTURED FORMAT:
  [Subject with identity details], [action in present tense].
  [Camera: shot type, one camera movement, lens/DoF hint].
  [Setting: location, time of day, weather/atmosphere].
  [Lighting: direction, quality, color temperature].
  [Style: one anchor keyword matching the requested style].
  Minimum 80 characters. Include the product/subject prominently.

  GOOD image prompt example:
  "Close-up with shallow depth of field, 35mm lens. A young woman with auburn hair and a red scarf holds a matte black ceramic mug, steam rising from the surface. Golden hour light streams through rain-streaked cafe windows, warm amber tones. Cinematic color grading, soft bokeh."

  BAD image prompt example (too vague):
  "A woman drinking coffee in a nice cafe with good lighting."

- **camera**: Camera shot type (e.g., "wide shot", "medium close-up", "over-the-shoulder", "aerial view", "low angle")

- **mood**: The emotional tone (e.g., "warm and inviting", "dramatic tension", "peaceful serenity")

- **negativePrompt**: What to EXCLUDE from this scene's generation (e.g., "motion blur, face distortion, text overlay"). Keep short, 5-10 terms.

- **audioDirection**: Sound design for this scene — ambient sounds, SFX, music cues, or dialogue. (e.g., "SFX: ceramic scrape on wood, soft jazz, cafe murmur" or "Quiet tension, distant thunder, no music")

Guidelines:
1. Maintain visual continuity across scenes — same character appearance, wardrobe, props
2. Include the product/subject consistently and prominently in each scene
3. If a character is specified, use the EXACT same identity description in every scene prompt
4. Build a narrative arc: establish → develop → climax → resolve
5. Vary camera angles and compositions for visual interest (wide → medium → close-up → wide)
6. Match all prompts to the specified visual style
7. Every prompt must be at least 80 characters with specific details — never generic`;

/**
 * Build mode-specific video prompt instructions
 */
function buildTransitionInstructions(profile: VideoPromptProfile): string {
  const tips = profile.videoPromptTips.map((t) => `  - ${t}`).join('\n');

  return `
TRANSITION VIDEO PROMPTS:
- **transition**: (REQUIRED for all scenes EXCEPT the last one) A video prompt describing the motion and action from THIS scene to the NEXT scene. This drives AI video generation between keyframes.

Structure: ${profile.structure}
Target length: ${profile.maxWords} words maximum.

Rules:
${tips}

GOOD transition example:
"${profile.exampleTransition}"

BAD transition example (too vague, no camera, no physics, no audio):
"Camera moves to next scene smoothly."

IMPORTANT: Write transition prompts that describe realistic camera movements WITH subject actions that bridge consecutive scenes. Do NOT generate "motion" fields.`;
}

function buildMotionInstructions(profile: VideoPromptProfile): string {
  const tips = profile.videoPromptTips.map((t) => `  - ${t}`).join('\n');

  return `
SINGLE-SHOT MOTION PROMPTS:
- **motion**: (REQUIRED for ALL scenes) A video prompt describing the action and movement WITHIN this scene. Each scene generates its own independent video clip.

Structure: ${profile.structure}
Target length: ${profile.maxWords} words maximum.

Rules:
${tips}

GOOD motion example:
"${profile.exampleMotion}"

BAD motion example (too vague, no endpoint, will cause generation to hang):
"Person does stuff with the product."

IMPORTANT: Write motion prompts that describe self-contained action within each scene. Always give motion a clear end state. Do NOT generate "transition" fields.`;
}

/**
 * Get the appropriate system prompt based on mode and target video model
 */
export function getSystemPrompt(
  mode: 'transition' | 'single-shot',
  targetVideoModel: VideoModelFamily = 'veo',
): string {
  const resolvedTargetVideoModel = normalizeStoryboardVideoModelFamily(targetVideoModel);
  const profile = VIDEO_PROMPT_PROFILES[resolvedTargetVideoModel];
  const imageTips = profile.imagePromptTips.map((t) => `- ${t}`).join('\n');
  const modeTip = profile.modes.i2v;
  const r2vTip = profile.modes.r2v ? `\nR2V mode: ${profile.modes.r2v}` : '';

  const modelSection = `
MODEL-SPECIFIC TIPS (optimized for ${resolvedTargetVideoModel.toUpperCase()}):

Prompt Formula: ${profile.formula}
Duration Range: ${profile.durationRange}
Aspect Ratios: ${profile.aspectRatios.join(', ')}
Reference Capabilities: ${profile.referenceCapabilities}

Image Prompt Tips:
${imageTips}

Video Mode Tips:
- T2V: ${profile.modes.t2v}
- I2V: ${modeTip}${r2vTip}

Audio Keywords & Syntax:
${profile.audioKeywords}

Example image prompt for this model:
"${profile.exampleImagePrompt}"

Default negative prompt terms: ${profile.negativePromptTips}`;

  const videoSection = mode === 'single-shot'
    ? buildMotionInstructions(profile)
    : buildTransitionInstructions(profile);

  const videoSettingsSection = `

VIDEO SETTINGS PER SCENE (MANDATORY):
For each scene, you MUST set:
- "videoAspectRatio": Choose from [${profile.aspectRatios.join(', ')}] ONLY. Pick based on composition:
  - 16:9 for landscapes, wide shots, cinematic framing
  - 9:16 for vertical/portrait, mobile-first, TikTok/Reels
  - 1:1 for centered subjects, product focus, Instagram
- "videoDuration": Choose from [${profile.validDurations.join(', ')}] seconds ONLY. Pick based on action complexity:
  - Short (${profile.validDurations[0]}-${profile.validDurations[Math.min(1, profile.validDurations.length - 1)]}s) for simple transitions, reveals, static compositions
  - Medium (${profile.validDurations[Math.floor(profile.validDurations.length / 2)]}s) for standard actions, camera movements
  - Long (${profile.validDurations[profile.validDurations.length - 1]}s) for complex multi-step sequences
  Default: ${profile.defaultDuration}s if unsure.

IMPORTANT: Any values outside these exact lists will cause video generation to FAIL.`;

  return `${STORYBOARD_BASE_GUIDELINES}
${modelSection}
${videoSection}
${videoSettingsSection}`;
}

/**
 * Legacy exports for backwards compatibility
 */
export const STORYBOARD_TRANSITION_PROMPT = getSystemPrompt('transition', 'veo');
export const STORYBOARD_SINGLE_SHOT_PROMPT = getSystemPrompt('single-shot', 'veo');
export const STORYBOARD_SYSTEM_PROMPT = STORYBOARD_TRANSITION_PROMPT;

// ============================================
// PROMPT BUILDER
// ============================================

/**
 * Build the user prompt from input data
 */
export function buildStoryboardPrompt(input: StoryboardInput): string {
  const targetModel = normalizeStoryboardVideoModelFamily(input.targetVideoModel || 'veo');
  const profile = VIDEO_PROMPT_PROFILES[targetModel];

  const modeInstruction = input.mode === 'single-shot'
    ? `\n\nMODE: Single-Shot — Generate a "motion" field for EVERY scene describing action within that scene (${profile.maxWords} words max each). Do NOT generate "transition" fields.`
    : `\n\nMODE: Transition — Generate a "transition" field for ALL scenes EXCEPT the last one, describing motion to the next scene (${profile.maxWords} words max each). Do NOT generate "motion" fields.`;

  // Build references block (N-ref) or fall back to legacy product/character
  let referencesBlock: string;
  if (input.references && input.references.length > 0) {
    const refLines = input.references.map((ref, i) => {
      const imgNote = ref.imageUrl ? ' [reference image attached]' : '';
      return `  ${i + 1}. [${ref.role.toUpperCase()}] "${ref.label}" (id: ${ref.id})${imgNote}\n     ${ref.description}`;
    }).join('\n');
    referencesBlock = `References:\n${refLines}`;
  } else {
    // Legacy fallback
    const characterLine = input.character ? `\nCharacter: ${input.character}` : '';
    referencesBlock = `Product/Subject: ${input.product || ''}${characterLine}`;
  }

  const hasCharacterRef = input.references?.some(r => r.role === 'character') || !!input.character;

  return `Create a ${input.sceneCount}-scene storyboard for:

${referencesBlock}
Concept: ${input.concept}
Style: ${input.style}
Target Video Model: ${targetModel.toUpperCase()}${modeInstruction}

Generate exactly ${input.sceneCount} scenes that tell a compelling visual story.
For EVERY scene, include: prompt (80+ chars), camera, mood, negativePrompt, audioDirection, videoAspectRatio, videoDuration, referenceIds (array of reference IDs that appear in that scene).
Generate a "referenceIdentities" array with an identity entry for EACH reference. ${hasCharacterRef ? '' : 'If any human character appears in the scenes (even if not listed as a reference), add a character entry to referenceIdentities with physical appearance details. '}Also generate legacy productIdentity and characterIdentity fields. Repeat all relevant identities verbatim in each scene prompt.`;
}

// ============================================
// REFINEMENT PROMPT BUILDERS
// ============================================

/**
 * Build a refinement system prompt that wraps the base system prompt
 * with additional instructions for iterative editing.
 */
export function getRefinementSystemPrompt(
  mode: 'transition' | 'single-shot',
  targetVideoModel: VideoModelFamily = 'veo',
): string {
  return `${getSystemPrompt(mode, targetVideoModel)}

REFINEMENT MODE:
You are refining an existing storyboard based on user feedback. Follow these rules:
1. Apply the user's feedback precisely — change only what they ask for.
2. Preserve unchanged scenes VERBATIM — copy exact prompts, camera, mood, transition/motion, negativePrompt, audioDirection.
3. Maintain narrative continuity and visual consistency across scenes.
4. Output ALL scenes in the storyboard, not just the changed ones.
5. Keep the same number of scenes unless the user explicitly requests adding or removing scenes.
6. Preserve referenceIdentities, productIdentity, and characterIdentity unless the user asks to change them.
7. Preserve per-scene referenceIds arrays unless the scene composition changes.`;
}

/**
 * Build a refinement user prompt with the FULL previous draft context + feedback.
 * Includes complete prompt text so the LLM doesn't regenerate from scratch. (#70)
 */
export function buildRefinementPrompt(
  previousDraft: {
    scenes: Array<{
      number: number;
      title: string;
      description: string;
      prompt: string;
      camera: string;
      mood: string;
      transition?: string;
      motion?: string;
      negativePrompt?: string;
      audioDirection?: string;
      videoAspectRatio?: string;
      videoDuration?: number;
      referenceIds?: string[];
    }>;
    summary: string;
    productIdentity?: string;
    characterIdentity?: string;
    referenceIdentities?: Array<{ refId: string; label: string; role: string; identity: string }>;
  },
  feedback: string,
  mode: 'transition' | 'single-shot',
): string {
  const sceneDetails = previousDraft.scenes.map((s) => {
    let detail = `  Scene ${s.number}: "${s.title}"
    Description: ${s.description}
    Camera: ${s.camera} | Mood: ${s.mood}
    Image Prompt: ${s.prompt}`;
    if (s.transition) detail += `\n    Transition: ${s.transition}`;
    if (s.motion) detail += `\n    Motion: ${s.motion}`;
    if (s.negativePrompt) detail += `\n    Negative: ${s.negativePrompt}`;
    if (s.audioDirection) detail += `\n    Audio: ${s.audioDirection}`;
    if (s.videoAspectRatio) detail += `\n    Aspect Ratio: ${s.videoAspectRatio}`;
    if (s.videoDuration) detail += `\n    Duration: ${s.videoDuration}s`;
    if (s.referenceIds?.length) detail += `\n    References in scene: ${s.referenceIds.join(', ')}`;
    return detail;
  }).join('\n\n');

  // Build identity section — prefer referenceIdentities, fall back to legacy
  let identitySection = '';
  if (previousDraft.referenceIdentities && previousDraft.referenceIdentities.length > 0) {
    const refLines = previousDraft.referenceIdentities.map(
      (ri) => `  [${ri.role.toUpperCase()}] "${ri.label}" (id: ${ri.refId}): ${ri.identity}`
    ).join('\n');
    identitySection = `Reference Identities:\n${refLines}`;
  } else {
    const legacyLines = [
      previousDraft.productIdentity && `Product Identity: ${previousDraft.productIdentity}`,
      previousDraft.characterIdentity && `Character Identity: ${previousDraft.characterIdentity}`,
    ].filter(Boolean).join('\n');
    identitySection = legacyLines;
  }

  return `Here is the current storyboard (${previousDraft.scenes.length} scenes):

Summary: ${previousDraft.summary}
${identitySection ? `\n${identitySection}\n` : ''}
Scenes:
${sceneDetails}

USER FEEDBACK:
${feedback}

Please update the storyboard based on the feedback above. Output ALL ${previousDraft.scenes.length} scenes${mode === 'transition' ? ' with transitions' : ' with motion prompts'}. Preserve unchanged scenes VERBATIM — do not rewrite prompts that the user did not ask to change. Preserve referenceIdentities and per-scene referenceIds unless the user asks to change them.`;
}
