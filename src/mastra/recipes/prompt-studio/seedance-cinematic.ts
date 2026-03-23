/**
 * Recipe: Seedance Cinematic Film
 *
 * Timestamped shot breakdowns, director styles, IMAX 70mm,
 * desaturated palettes, and slow-motion techniques.
 * Source: awesome-seedance (CC BY 4.0)
 * ~1.8K tokens when injected.
 */

export const SEEDANCE_CINEMATIC_RECIPE = `
<recipe name="seedance-cinematic">
<title>Cinematic Film (Seedance)</title>
<description>Timestamped shot-by-shot breakdowns for cinematic video prompts. Ideal for Seedance 2.0, Veo 3, Kling 3.0.</description>

<prompt-format>
Structure every video prompt as a timestamped shot list:

[Style Declaration] — [Duration]

[00:00-05s] Shot 1: (LABEL). Description of action, framing, camera movement. Lighting and atmosphere.
[05:00-10s] Shot 2: (LABEL). Description. Dialogue cue if any. Color/mood shift.
[10:00-15s] Shot 3: (LABEL). Climax or resolution. Final visual beat.

Always include: camera angle, movement, lighting mood, color palette, and emotional intent per shot.
</prompt-format>

<patterns>
<pattern name="racing-thriller">
[Cinematic Thriller] — 15 seconds, desaturated palette, handheld tension

[00:00-05s] Shot 1: (EXTERIOR — RAIN). Extreme wide shot. A lone racing car tears through a rain-soaked mountain pass at dusk. Rain lashes the windshield. Dashboard lights reflect on the driver's visor. Desaturated blues and cold tungsten. Handheld micro-shake.
[05:00-10s] Shot 2: (COCKPIT). Medium close-up through rain-streaked glass. Driver's eyes narrow — split-second decision. Gear shift. Engine roar builds. Frame-stepping effect (stop-motion feel). Warm amber dashboard glow vs cold blue exterior.
[10:00-15s] Shot 3: (AERIAL). Drone pull-back reveals the cliff edge. Car drifts through the turn, taillights painting red streaks through mist. Slow-shutter motion blur. Score: deep bass pulse, silence, then exhale.
</pattern>

<pattern name="contemplative-drama">
[Art House Drama] — 15 seconds, Wong Kar-wai inspired

[00:00-05s] Shot 1: (INTERIOR — CAFÉ). Close-up of espresso cup, steam rising. Rack focus to a woman's face reflected in the window. Neon signs bleed warm pink and green through rain droplets. 35mm film grain, Kodak Vision3 500T.
[05:00-10s] Shot 2: (WINDOW). Slow dolly right. Her hand traces the condensation on glass. City traffic blurs outside — bokeh circles of headlights. Melancholic score, solo piano. Natural practicals only — no key light.
[10:00-15s] Shot 3: (EXTERIOR). Wide shot from across the street. She exits the café into rain. Umbrella pops open. Camera holds static as she walks away into the neon-soaked night. Long lens compression (200mm). Fade to black.
</pattern>

<pattern name="epic-landscape">
[IMAX Epic] — 15 seconds, Villeneuve-scale grandeur

[00:00-05s] Shot 1: (ESTABLISHING). Extreme wide, IMAX 70mm. A solitary figure stands on a vast desert dune at golden hour. Wind lifts sand particles catching the last light. Deep warm oranges and violet shadows. Locked-off tripod. Silence except for wind.
[05:00-10s] Shot 2: (MEDIUM WIDE). Slow crane up revealing the scale — endless dunes to the horizon. Figure begins walking. Footsteps leave trails. Low angle, worm's eye perspective. Hans Zimmer-style sustained bass drone.
[10:00-15s] Shot 3: (AERIAL PULLBACK). Drone ascends vertically. The figure becomes a speck. The landscape stretches impossibly. God rays break through cloud gaps. The scale is overwhelming. Cut to black.
</pattern>
</patterns>

<tips>
- Always specify duration (10-15s for Seedance 2.0)
- Include temporal camera descriptions: "slowly dollies in over 4 seconds"
- Specify color temperature and film stock references
- Add audio/score hints for mood (the model responds to audio mood cues)
- Use shot labels like (EXTERIOR), (CLOSE-UP), (AERIAL) for clarity
- End with a strong visual beat — freeze frame, fade to black, or slow motion
- Dialogue cues: use brackets like [whispers] "line here" for lip-sync guidance
</tips>
</recipe>
`;
