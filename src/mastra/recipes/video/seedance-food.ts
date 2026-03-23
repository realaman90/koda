/**
 * Video Recipe: Seedance Food Cinema
 *
 * Macro pour, chef's table, dish-comes-alive shots for Seedance 2.0.
 * ~1.5K tokens when injected.
 */

export const SEEDANCE_FOOD_RECIPE = `
<recipe name="seedance-food">
<title>Food Cinema (Seedance)</title>
<description>Macro pour shots, chef's table plating, and dish-comes-alive moments with steam and sizzle. Optimized for Seedance 2.0 physics simulation.</description>

<templates>
<template name="macro-pour">
Slow viscous liquid pour with extreme detail.

Prompt structure:
\`\`\`
Close-up of thick golden [honey/caramel/sauce] pouring in a slow viscous stream onto a stack of [pancakes/dessert] @image1. The liquid pools and overflows the edges. Macro lens, shallow DOF. Top-down crane slowly tilting to 45 degrees. Ambient pour and drip audio. 8s.
\`\`\`
</template>

<template name="chefs-table-plating">
Overhead plating sequence with precise hand movements.

Prompt structure:
\`\`\`
Top-down view of a white plate on dark slate. Chef's hands carefully place [micro-greens/garnish] using tweezers, then drizzle a thin line of [reduction/oil]. Steam rises gently from the [protein]. Slow orbit from top-down to 30 degrees. Kitchen ambient audio. 12s.
\`\`\`
</template>

<template name="dish-comes-alive">
Dramatic food moment: steam, sizzle, or flame.

Prompt structure:
\`\`\`
A cast iron skillet on flame. Raw [steak/shrimp] drops onto the hot surface, instant sizzle and oil splash. Steam and smoke rise dramatically. Close-up push in, shallow DOF, warm tungsten light. Sizzle and crackle audio. 7s.
\`\`\`
</template>
</templates>

<physics-keywords>viscous flow, steam rising, oil shimmer, sizzle splash, caramel drip, foam settle</physics-keywords>

<camera-keywords>top-down crane, slow orbit, close-up push, macro slide, 45-degree tilt</camera-keywords>

<audio-keywords>sizzle, pour, drip, crackle, ambient kitchen, boil, chop</audio-keywords>

<tips>
- Seedance handles viscous fluid physics well; describe flow speed and viscosity explicitly
- Pin the food item or action in the first 20 words
- Top-down to angled crane moves create the most cinematic food shots
- Steam and smoke rise naturally; mention "rises dramatically" for more visible effect
- Warm tungsten or golden light sells food better than cool/neutral tones
- Keep shots 7-12s for best quality; longer pours can go to 15s
- One hero action per shot: pour OR sizzle OR plate, not all three
</tips>
</recipe>
`;
