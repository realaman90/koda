/**
 * Recipe: NanoBanana Creative Experiments
 *
 * Recursive visuals, Droste effect, coordinate viz,
 * film photography emulation, and surreal composites.
 * Source: awesome-nanobanana-pro (CC BY 4.0)
 * ~1.6K tokens when injected.
 */

export const NANOBANANA_CREATIVE_RECIPE = `
<recipe name="nanobanana-creative">
<title>Creative & Experimental (NanoBanana)</title>
<description>Recursive visuals, surreal composites, film emulation, Droste effects, and artistic experiments. Optimized for Nano Banana Pro and Nano Banana 2.</description>

<prompt-format>
Creative prompts break rules intentionally. Structure as:

CONCEPT: [the core visual idea or illusion]
TECHNIQUE: [specific visual technique: recursion, double exposure, tilt-shift, etc.]
CAMERA: [real camera specs to ground the surrealism in photographic reality]
EXECUTION: [detailed description of how the concept manifests]
MOOD: [emotional tone and atmosphere]
CONSTRAINTS: [what to avoid to preserve the illusion]
</prompt-format>

<patterns>
<pattern name="droste-recursion">
CONCEPT: Infinite recursive image — a person holding a photograph of themselves holding a photograph, repeating infinitely.

TECHNIQUE: Droste effect / mise en abyme
CAMERA: Canon EOS R5 + 35mm f/1.4, natural perspective
EXECUTION: A woman sits in a vintage armchair in a cozy room. She holds a framed photograph of the exact same scene — herself in the same chair, holding the same photo. Each nested image is slightly smaller, perfectly aligned, repeating at least 5 visible levels deep. The lighting, color, and angle are identical at every level. Each recursion is sharp enough to read details.
MOOD: Contemplative, slightly uncanny. Warm lamplight. Quiet afternoon.
CONSTRAINTS: Each recursion must maintain consistent lighting and angle. No blur in the nested images — they should be pin-sharp prints. The frame edges must align perfectly.
</pattern>

<pattern name="miniature-tilt-shift">
CONCEPT: Real city scene that looks like a miniature model/diorama through tilt-shift photography.

TECHNIQUE: Tilt-shift lens effect
CAMERA: Canon TS-E 24mm f/3.5L tilt-shift lens, or simulated tilt-shift
EXECUTION: Bird's eye view of a busy intersection in Tokyo. Extreme tilt-shift blur on top and bottom thirds — only a thin horizontal band in the middle is sharp. Cars become toy-like. People become figurines. Oversaturated colors like a painted model. The depth compression makes buildings look like dollhouse miniatures. Midday sun, hard shadows that enhance the model-like appearance.
MOOD: Whimsical, detached, god's-eye curiosity. Like peering into a diorama.
CONSTRAINTS: Must be shot from elevated position (bird's eye or high angle). Aggressive blur gradient. Slightly boosted saturation to enhance the miniature illusion.
</pattern>

<pattern name="double-exposure-portrait">
CONCEPT: A portrait where the person's silhouette is filled with a landscape — their inner world made visible.

TECHNIQUE: In-camera double exposure
CAMERA: Hasselblad 500C/M, medium format film, Ilford HP5+ 400 (black and white)
EXECUTION: First exposure: strong profile silhouette of a man against a bright white sky. Hard rim light defines the jaw, nose, forehead. Second exposure: a dense pine forest fills the silhouette. Trees grow from the neck, canopy reaches the crown of the head. Birds fly where the mind would be. Outside the silhouette: pure white. The overlap zone where forest meets face creates ghostly transparency.
MOOD: Introspective, poetic. Quiet solitude. Connection between human and nature.
CONSTRAINTS: Black and white only — color would distract from the technique. The silhouette must have strong, recognizable edges. The landscape must fill the figure completely without spilling outside.
</pattern>

<pattern name="film-era-emulation">
CONCEPT: Modern subject photographed to look authentically like a specific film era.

TECHNIQUE: Film photography emulation (1970s Kodachrome)
CAMERA: Nikon F2 + 50mm f/1.4 Nikkor (manual focus)
EXECUTION: A young woman in a sundress stands in a sunlit field of wildflowers. Shot on Kodachrome 64: ultra-saturated reds and greens, slightly warm midtones, cooler shadows. Characteristic Kodachrome contrast curve — punchy but not crushed. Visible film grain (ISO 64 grain structure: fine, uniform). Slight vignetting from the vintage lens. Focus is soft at wide aperture — dreamy Nikkor rendering. Slide film color precision.
MOOD: Nostalgic, sun-drenched, timeless. Like finding a perfect slide in a shoebox at a flea market.
CONSTRAINTS: No modern color grading — must look like actual Kodachrome, not a filter. Grain must be film grain, not digital noise. Period-accurate clothing and setting (or timeless enough to pass).
</pattern>
</patterns>

<tips>
- Creative prompts need real camera specs to "ground" the surrealism — without them, results look like generic digital art
- For recursion/Droste: emphasize "consistent lighting at every level" and "pin-sharp nested images"
- For tilt-shift: specify "bird's eye angle" and "aggressive blur gradient" — the angle is critical
- For double exposure: describe both exposures separately, then the overlap
- Film emulation: name the SPECIFIC film stock (Kodachrome 64, Tri-X 400, Cinestill 800T) — each has unique color science
- Constraints are as important as descriptions — tell the model what NOT to do
- Nano Banana 2 excels at maintaining fine details in creative compositions
- For surreal work: one impossible element in an otherwise photorealistic scene is more impactful than everything being surreal
- NB2 EDITING: Use edit mode for iterative creative work — generate base, then "add Droste effect", "shift to double exposure"
- NB2 TEXT: For creative typography (magazine covers, posters with text), NB2 renders legible stylized text — specify exact content
- NB2 SEARCH: For real-world creative mashups (real person in surreal scene), use search grounding for factual accuracy
</tips>
</recipe>
`;
