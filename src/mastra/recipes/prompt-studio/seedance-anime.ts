/**
 * Recipe: Seedance Anime / Animation
 *
 * Character battles, mecha, Van Gogh oil paint style,
 * particle transitions, and experimental visual styles.
 * Source: awesome-seedance (CC BY 4.0)
 * ~1.6K tokens when injected.
 */

export const SEEDANCE_ANIME_RECIPE = `
<recipe name="seedance-anime">
<title>Anime & Artistic Styles (Seedance)</title>
<description>Anime-style battles, painterly aesthetics (Van Gogh, oil paint), and experimental visual styles for video generation.</description>

<prompt-format>
Structure anime/artistic video prompts with:
1. Visual style declaration (anime, oil paint, watercolor, etc.)
2. Character/scene setup with strong silhouettes
3. 4-act structure: Stillness → Burst → Clash → Resolution
4. Particle effects and transitions between acts
5. Emphasis on motion continuity and impact frames

Test for: limb breakdown, debris trajectory, physics, particle continuity.
</prompt-format>

<patterns>
<pattern name="elemental-battle">
[Anime Battle — Elemental Clash] — 15 seconds, high-energy shounen style

[00:00-04s] Act 1: (STILLNESS). Two warriors face each other across a scorched battlefield. Wind stirs dust. Close-up of eyes — one glows ember-red, the other ice-blue. Tension builds. Cherry blossom petals drift between them. Locked-off wide shot.
[04:00-08s] Act 2: (BURST). Fire warrior launches — flame spiral erupts from feet, scorching the ground. Speed lines and impact frames. Match cut: ice warrior responds — blade of frozen air slices forward. Shattered ice crystals transform into dancing red leaves mid-air. Particle continuity.
[08:00-12s] Act 3: (CLASH). Collision in center frame. Fire meets ice — massive shockwave. Steam explosion. Camera rotates 360 degrees around the impact point. Debris trajectory: rocks float, petals burn, ice shards refract rainbow light. High-frequency action.
[12:00-15s] Act 4: (RESOLUTION). Smoke clears. Both warriors stand back-to-back. Spirit animals manifest above them — a phoenix spiraling upward, a frost dragon inverting. Sky splits: orange sunset on one side, aurora borealis on the other. Hold on the symmetry. Fade.
</pattern>

<pattern name="van-gogh-landscape">
[Painterly — Van Gogh Style] — 10 seconds, living oil painting

[00:00-04s] Shot 1: (ESTABLISHING). A wheat field under a turbulent sky — but everything is thick impasto oil paint. Swirling brushstrokes animate in real-time. Visible paint texture catches light. Colors: cadmium yellow, ultramarine blue, raw sienna. The sky churns like Starry Night.
[04:00-07s] Shot 2: (MOVEMENT). A figure walks through the field — their form is painted, not photorealistic. Each step leaves brushstroke ripples in the wheat. Crows take flight — painted in bold black strokes that dissolve into the turbulent sky. Wind direction visible in brushstroke flow.
[07:00-10s] Shot 3: (TRANSFORMATION). Camera tilts up to the sky. The swirling clouds part to reveal actual stars — a transition from paint to photorealism. The paint texture gradually smooths into reality. The boundary between art and photography blurs. Beautiful ambiguity.
</pattern>

<pattern name="mecha-transform">
[Mecha Transformation] — 15 seconds, sci-fi anime aesthetic

[00:00-05s] Shot 1: (APPROACH). Night city skyline, neon-drenched. A massive humanoid mech walks between skyscrapers. Each footstep sends shockwaves through puddles. Reflection of neon on wet metal panels. Low angle, worm's eye. Scale is overwhelming.
[05:00-10s] Shot 2: (TRANSFORMATION). The mech begins to transform — panels shift, fold, reconfigure. Mechanical precision: each piece clicks into place with satisfying sound design. Internal glowing energy core revealed momentarily. Sparks fly from friction points. Camera orbits the transformation.
[10:00-15s] Shot 3: (REVEAL). New form complete — sleeker, weapon systems deployed. Energy pulse radiates outward. City lights flicker from the electromagnetic wave. Rain starts falling, each drop catching neon light. Hero pose against a lightning-split sky. Hold for impact.
</pattern>
</patterns>

<tips>
- For anime: emphasize impact frames (white flash + speed lines) and particle continuity
- Match cut editing works great: flame ring → ice blade, petals → embers
- Painterly styles: specify brush type (impasto, watercolor wash, ink wash) and describe texture
- Spirit animals / energy manifestations add visual drama to battles
- Transformation sequences: describe mechanical precision, clicks, and energy reveals
- Use color symbolism: warm = power/aggression, cool = calm/ice/precision
- Specify camera rotation for dynamic action: "camera rotates 360 around impact point"
</tips>
</recipe>
`;
