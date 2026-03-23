/**
 * Video Recipe: Kling Action Shots
 *
 * Slow-mo athlete, fast product showcase, dynamic sport sequences for Kling 2.0/2.1.
 * ~1.5K tokens when injected.
 */

export const KLING_ACTION_RECIPE = `
<recipe name="kling-action">
<title>Action Shots (Kling)</title>
<description>Slow-motion action, fast-cut product showcases, and dynamic sport sequences optimized for Kling 2.0/2.1. Uses ++emphasis++ weighting and clear end states.</description>

<emphasis-syntax>
Kling supports ++emphasis++ weighting to boost specific visual elements.
Example: "++explosive paint splash++ erupts behind the athlete"
Use sparingly: 1-2 emphasized phrases per prompt maximum.
</emphasis-syntax>

<end-state-requirement>
Kling produces best results when the prompt specifies a clear END STATE.
Always describe what the final frame looks like.
Example: "...ending with the shoe centered in frame, paint frozen mid-air around it."
</end-state-requirement>

<templates>
<template name="slow-mo-action">
Dramatic slow-motion athletic or dynamic moment.

Prompt structure:
\`\`\`
A runner in black sprints toward camera on a wet track at dusk. ++water droplets explode++ from each footstrike in slow motion. Rim light catches every droplet. Dolly zoom holds the runner centered. Ending with a freeze frame of the runner mid-stride, droplets suspended. 5s.
\`\`\`
</template>

<template name="fast-cut-product-showcase">
Rapid dynamic angles of a product with energy and motion.

Prompt structure:
\`\`\`
A matte black wireless speaker @image1 spins against a dark void. ++neon light trails++ orbit the speaker. Quick arc track around the product. Bass pulse ripples the air. Ending with the speaker front-facing, logo visible, light trails settled into a halo. 5s.
\`\`\`
</template>

<template name="dynamic-sport-sequence">
High-energy sport moment with cinematic camera work.

Prompt structure:
\`\`\`
A skateboarder launches off a half-pipe against a vivid sunset sky. ++board flips++ beneath their feet in slow motion. Crane pan follows the arc upward. Ending with the skateboarder catching the board, landing clean, arms balanced. 10s.
\`\`\`
</template>
</templates>

<camera-keywords>dolly zoom, arc track, crane pan, handheld shake, tracking side, whip pan</camera-keywords>

<elements-feature>
Kling's Elements feature locks visual consistency across shots.
When generating a series, define the character or product as an Element first,
then reference it in subsequent prompts for consistent appearance.
</elements-feature>

<tips>
- Use ++emphasis++ on the one visual detail you want Kling to nail (paint splash, light trail, etc.)
- Always include a clear end state describing the final frame
- Duration: 5s for punchy action, 10s for sequences with buildup
- Kling handles fast camera moves (whip pan, dolly zoom) better than most models
- Slow motion is triggered by describing "slow motion" or "slowed" explicitly
- Dark backgrounds with rim light or neon produce the most dramatic Kling results
- Use Elements feature for multi-shot consistency of characters or products
</tips>
</recipe>
`;
