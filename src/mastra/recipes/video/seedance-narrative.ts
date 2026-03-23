/**
 * Video Recipe: Seedance Narrative Arc
 *
 * Morning ritual, transformation arc, day-in-life montage for Seedance 2.0.
 * ~1.5K tokens when injected.
 */

export const SEEDANCE_NARRATIVE_RECIPE = `
<recipe name="seedance-narrative">
<title>Narrative Arc (Seedance)</title>
<description>Morning ritual arcs, transformation montages, and day-in-life sequences. Multi-shot storytelling with character consistency tips for Seedance 2.0.</description>

<templates>
<template name="morning-ritual-arc">
Character waking up through a sequence of calm morning actions.

Prompt structure:
\`\`\`
A woman in a white linen shirt opens her eyes in soft morning light. She reaches for a ceramic mug on the nightstand. shot switch. Her hands wrap around the mug, steam curls upward. She takes a slow sip, eyes closing with satisfaction. Warm golden light, shallow DOF. 12s.
\`\`\`
</template>

<template name="transformation-montage">
Before-and-after arc showing change over time.

Prompt structure:
\`\`\`
A cluttered desk covered in papers and empty cups. Hands begin sorting, stacking, clearing. shot switch. The same desk is now clean and minimal: a single notebook, a pen, a plant. Camera pulls back slowly to reveal a bright organized room. Natural window light. 10s.
\`\`\`
</template>

<template name="day-in-life-sequence">
Multi-shot montage of diverse daily moments.

Prompt structure:
\`\`\`
A man in a navy jacket steps out a front door into morning sun, breath visible in cold air. shot switch. His hands type rapidly on a laptop in a bright cafe, coffee beside him. shot switch. He walks along a river path at golden hour, earbuds in, relaxed smile. Handheld gimbal, natural light. 15s.
\`\`\`
</template>
</templates>

<multi-shot-syntax>
Use "shot switch" between scene descriptions to create montage cuts.
Each shot should have its own location, lighting, and action.
</multi-shot-syntax>

<emotional-arc-structure>
Effective narrative arcs follow: Calm open → Tension or action → Resolution or payoff.
Even in 10-15s, this three-beat structure creates satisfying pacing.
</emotional-arc-structure>

<character-consistency>
- Describe the character once in detail in the first shot (clothing, hair, features)
- In subsequent shots, reference the same details: "the same woman in the white linen shirt"
- Keep wardrobe consistent across shots; avoid changing outfits unless showing time passage
- Consistent lighting temperature helps: all warm, or all cool
</character-consistency>

<tips>
- Multi-shot montages work best at 10-15s total
- Pin character description in the first 20 words of the first shot
- Use "shot switch" for clean cuts; Seedance handles 2-3 switches well
- More than 3 shot switches may degrade individual shot quality
- Golden hour and morning light are the most reliable cinematic looks
- Handheld gimbal or slow dolly for narrative; avoid dramatic camera moves
- Emotion reads best on close-ups: face, hands, small gestures
</tips>
</recipe>
`;
