/**
 * Video Recipe: Seedance Product Reveal
 *
 * Float, rotate, break-out-of-frame effects for Seedance 2.0.
 * ~1.5K tokens when injected.
 */

export const SEEDANCE_PRODUCT_RECIPE = `
<recipe name="seedance-product">
<title>Product Reveal (Seedance)</title>
<description>Floating, rotating, and break-out-of-frame product shots optimized for Seedance 2.0. Pin the subject in the first 20 words, use physics keywords, and keep duration 5-15s.</description>

<formula>Opening shot → Subject → Action → Physics → Camera → Audio → Arc</formula>

<reference-syntax>
Use @image1 to reference the first uploaded product image, @video1 for the first reference video.
Example: "A sleek black headphone @image1 floats upward..."
</reference-syntax>

<templates>
<template name="product-reveal-float">
Product levitation with slow rotation against a clean backdrop.

Prompt structure:
\`\`\`
A [material] [product] @image1 rests on a [surface]. It lifts off and floats upward, rotating slowly 360 degrees. Soft volumetric light catches the surface detail. Shallow depth of field, bokeh background. [brand color] gradient backdrop. Slow gimbal orbit. 10s.
\`\`\`
</template>

<template name="break-out-of-frame">
Product punches through a flat graphic layer into 3D space.

Prompt structure:
\`\`\`
A flat [product] graphic @image1 sits centered on a [color] background. The [product] shatters the flat surface and pushes toward the camera in 3D, fragments dissolving into particles. Dolly in slow. Dramatic rim light. 8s.
\`\`\`
</template>

<template name="product-macro">
Extreme close-up showcasing material and texture detail.

Prompt structure:
\`\`\`
Extreme macro shot of [product] @image1 surface. Camera glides across the [material] texture, catching micro-reflections and fine detail. Shallow DOF, anamorphic bokeh. Slow dolly right. Ambient hum. 7s.
\`\`\`
</template>

<template name="unboxing">
First-person unboxing with anticipation arc.

Prompt structure:
\`\`\`
Hands lift the lid of a minimal [color] box. Inside, [product] @image1 is cradled in molded foam. Fingers lift the product, it catches the light as it rises. Top-down crane to eye level. Soft crinkle audio. 12s.
\`\`\`
</template>
</templates>

<physics-keywords>float, shatter, ripple, dissolve, levitate, scatter, implode</physics-keywords>

<camera-keywords>dolly in slow, gimbal orbit, crane down, tripod lock, macro slide</camera-keywords>

<tips>
- Pin the subject in the first 20 words so Seedance locks onto it early
- Use card-style structure: one clear action per shot, no compound sentences
- Limit to one camera move per shot for best results
- Duration sweet spot: 5-15s (8-10s is ideal for product hero shots)
- Physics keywords (float, shatter, ripple) trigger Seedance motion priors effectively
- Keep backgrounds simple: solid gradient, studio void, or subtle environment
</tips>
</recipe>
`;
