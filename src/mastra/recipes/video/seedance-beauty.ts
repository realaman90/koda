/**
 * Video Recipe: Seedance Beauty ASMR
 *
 * ASMR texture, skin glow, skincare routine sequences for Seedance 2.0.
 * ~1.5K tokens when injected.
 */

export const SEEDANCE_BEAUTY_RECIPE = `
<recipe name="seedance-beauty">
<title>Beauty ASMR (Seedance)</title>
<description>ASMR texture close-ups, skin glow application, and multi-shot beauty routines optimized for Seedance 2.0. Macro lens, shallow DOF, slow speed.</description>

<templates>
<template name="asmr-texture-closeup">
Extreme close-up of product texture with satisfying tactile detail.

Prompt structure:
\`\`\`
Extreme close-up of fingertips pressing into a thick [cream/gel/balm] @image1. The texture dimples and slowly rebounds. Soft side light reveals shimmer particles. Macro lens, shallow DOF, slow speed. ASMR crinkle and soft squelch audio. 8s.
\`\`\`
</template>

<template name="skin-glow-application">
Product application with visible glow transformation.

Prompt structure:
\`\`\`
A hand gently pats [serum/moisturizer] onto a cheek. The skin gradually develops a dewy glow, light catching each micro-droplet. Close-up face, soft ring light, shallow DOF. Slow dolly in. Soft tap and drip audio. 10s.
\`\`\`
</template>

<template name="beauty-routine-montage">
Multi-shot skincare sequence with shot switches.

Prompt structure:
\`\`\`
Close-up of hands pumping [cleanser] into palms, lathering between fingers. shot switch. Foam applied in circular motions across face, eyes gently closed. shot switch. Water rinses foam, revealing clean glowing skin. Warm soft light, macro lens. 15s.
\`\`\`
</template>
</templates>

<multi-shot-syntax>
Use "shot switch" between scene descriptions to create montage cuts within a single generation.
Example: "Shot A description. shot switch. Shot B description."
</multi-shot-syntax>

<audio-triggers>ASMR crinkle, drip, soft tap, squelch, water rinse, gentle pour</audio-triggers>

<tips>
- Use macro lens + shallow DOF for all beauty shots (Seedance excels at this)
- Slow speed renders textures and glow more convincingly
- Pin the product or body part in the first 20 words
- "shot switch" enables multi-shot routines in a single prompt
- Audio triggers (crinkle, drip, soft tap) are recognized by Seedance audio model
- Keep lighting soft and directional: ring light, side light, or golden hour
- Avoid fast camera movement; slow dolly or static works best
</tips>
</recipe>
`;
