/**
 * Video Recipe: Universal Luxury Editorial
 *
 * Silent statement, luxury unbox, editorial sweep. Model-agnostic.
 * ~1.2K tokens when injected.
 */

export const UNIVERSAL_LUXURY_RECIPE = `
<recipe name="universal-luxury">
<title>Luxury Editorial (Universal)</title>
<description>Silent statement pieces, luxury unboxing, and editorial sweeps that work across Seedance, Kling, and Veo. Emphasis on lighting, texture, and slow deliberate camera movement.</description>

<model-note>
These templates are model-agnostic. They avoid model-specific syntax (no ++emphasis++, no "shot switch", no "says:") so they render well on any video model.
</model-note>

<templates>
<template name="silent-statement">
Hero product shot with no dialogue, pure visual storytelling.

Prompt structure:
\`\`\`
A [product] @image1 sits on a slab of raw [marble/concrete/wood] under a single overhead spotlight. The camera slowly dollies in. Light shifts gradually, revealing surface texture and material detail. Deep shadows, minimal set, black background. 10s.
\`\`\`
</template>

<template name="luxury-unbox">
Elevated unboxing with premium materials and deliberate pacing.

Prompt structure:
\`\`\`
A pair of hands in soft focus lifts the magnetic lid off a matte black box. Inside, [product] @image1 rests on ivory suede. Fingers lift the product slowly, angling it to catch a warm key light. Shallow DOF, dark environment, single warm light source. Slow crane from top-down to eye level. 12s.
\`\`\`
</template>

<template name="editorial-sweep">
Fashion or product editorial with sweeping cinematic camera.

Prompt structure:
\`\`\`
A [watch/bag/shoe] @image1 rests on a reflective black surface. The camera executes a slow 180-degree orbit, catching highlights and reflections at each angle. Soft fill light, sharp specular highlights, shallow DOF. Black or deep charcoal background. 10s.
\`\`\`
</template>
</templates>

<lighting-principles>
- Single key light with minimal fill creates luxury contrast
- Warm color temperature (3200K-4000K) reads as premium
- Specular highlights on metal, glass, or leather sell quality
- Deep shadows add drama; avoid flat even lighting
</lighting-principles>

<tips>
- Works with Seedance, Kling, and Veo equally well (no model-specific syntax)
- Slow camera movement only: dolly in, slow orbit, gentle crane
- Keep backgrounds dark and minimal: black void, raw stone, or dark wood
- Texture is everything: describe the material (brushed aluminum, matte leather, polished glass)
- No dialogue, no text overlays, no complex action; let the product speak
- 10-12s is ideal; luxury pacing needs time to breathe
- Shallow DOF with one sharp focal point on the product
</tips>
</recipe>
`;
