/**
 * Recipe: Seedance Commercial / Advertising
 *
 * Product showcases, brand videos, motion graphics style.
 * Source: awesome-seedance (CC BY 4.0)
 * ~1.5K tokens when injected.
 */

export const SEEDANCE_COMMERCIAL_RECIPE = `
<recipe name="seedance-commercial">
<title>Commercial & Advertising (Seedance)</title>
<description>Product showcase videos, brand campaigns, and advertising-style motion. Ideal for Seedance 2.0, Veo 3, Kling 3.0.</description>

<prompt-format>
Structure product/brand video prompts with:
1. Product/brand identification
2. Visual treatment (lighting, surface, environment)
3. Camera choreography tied to product reveal
4. Pace and energy level
5. End card / logo beat

Avoid heavy texture overlays and cutout effects — keep it clean and professional.
</prompt-format>

<patterns>
<pattern name="luxury-product-reveal">
[Premium Product Launch] — 10 seconds, sleek and minimal

[00:00-03s] Shot 1: (MACRO). Extreme close-up of product surface — light catches brushed metal edges. Slow dolly along the seam. Reflections of studio softboxes glide across the surface. Black background, single key light at 45 degrees. Shallow DOF.
[03:00-07s] Shot 2: (HERO ROTATION). Product floats center frame, rotating 180 degrees. Camera trucks left while product rotates right — parallax reveal. Subtle caustic light patterns dance on the surface. Clean white environment. Brisk pace.
[07:00-10s] Shot 3: (BEAUTY SHOT). Product settles. Logo materializes in elegant typography. Soft rim light halos the edges. Fade up brand tagline. Minimal motion — confidence in stillness.
</pattern>

<pattern name="lifestyle-brand">
[Brand Lifestyle Film] — 15 seconds, warm and aspirational

[00:00-05s] Shot 1: (GOLDEN HOUR). Wide shot — person runs along a coastline at sunset. Product visible in context (wearing/using). Warm 3200K light wraps the scene. Handheld Steadicam follow. Natural sound: waves, breathing.
[05:00-10s] Shot 2: (DETAIL). Close-up of the product in use — texture, material, the moment of interaction. Slow motion 120fps. Shallow DOF isolates the product. Warm backlight creates rim glow. Natural, unforced.
[10:00-15s] Shot 3: (WIDE PULLBACK). Back to the landscape. Person continues into the distance. Product sits in frame as a hero object in foreground. Golden light flares. Brand logo fades in lower third. Aspirational but authentic.
</pattern>

<pattern name="motion-graphics-style">
[MG Animation] — 10 seconds, dynamic and bold

[00:00-03s] Shot 1: (WIPE IN). Bold graphic shapes slide in from edges — brand colors. Typography animates letter by letter. Clean vector aesthetic. Punchy rhythm — each element hits on a beat.
[03:00-07s] Shot 2: (INFOGRAPHIC). Data points and features animate in sequence. Icons morph into product silhouettes. Smooth easing, elastic overshoot. Brand palette: 2-3 colors max. White or dark background.
[07:00-10s] Shot 3: (RESOLVE). All elements converge to form the product image or logo. Satisfying settle animation. Tagline types on. Clean end card.
</pattern>
</patterns>

<tips>
- Keep product lighting clean — avoid heavy grading that obscures materials
- Specify pace: "brisk" for energy, "deliberate" for luxury
- Use voice-over cues: (VO: "Experience the difference") for guided pacing
- Natural lighting integration works best for lifestyle shoots
- For motion graphics: specify easing (elastic, ease-out) and rhythm (on-beat, staggered)
- End with a clear brand moment — logo + tagline
</tips>
</recipe>
`;
