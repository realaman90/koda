/**
 * Recipe: NanoBanana Photorealism
 *
 * Professional photography prompts with precise camera specs:
 * camera body, lens, aperture, ISO, shutter speed, film stock.
 * Source: awesome-nanobanana-pro (CC BY 4.0)
 * ~2K tokens when injected.
 */

export const NANOBANANA_PHOTOREALISM_RECIPE = `
<recipe name="nanobanana-photorealism">
<title>Pro Photorealism (NanoBanana)</title>
<description>Professional photography prompts with exact camera specs — lens, aperture, ISO, film stock. Optimized for Nano Banana Pro and Nano Banana 2.</description>

<prompt-format>
Structure photorealistic prompts as a photographer's shot sheet:

SUBJECT: [specific description]
CAMERA: [body] + [lens mm] f/[aperture]
SETTINGS: ISO [value], [shutter speed], [white balance]
LIGHTING: [key light setup], [fill], [rim/hair], [practicals]
COLOR: [film stock reference or grade], [temperature K]
ENVIRONMENT: [location, time of day, weather]
COMPOSITION: [framing, angle, depth of field description]
TEXTURE: [surface details, material qualities]

The more specific the camera specs, the more realistic and controlled the output.
</prompt-format>

<patterns>
<pattern name="editorial-portrait">
SUBJECT: 28-year-old woman with freckles and auburn hair, wearing a cream linen shirt, looking directly at camera with quiet confidence. Natural catchlights in the eyes.

CAMERA: Sony A7III + 85mm f/1.4 GM
SETTINGS: ISO 400, 1/200s, AWB
LIGHTING: Single large window camera-left (north-facing, soft diffused daylight), no fill, subtle hair light from behind at 5600K. Negative fill on shadow side with black V-flat.
COLOR: Kodak Portra 400 film stock, warm muted tones, subtle film grain. Color temp 5200K.
ENVIRONMENT: Minimalist studio apartment, morning light, sheer curtains diffusing the window.
COMPOSITION: Medium close-up, shallow DOF f/1.4, eyes razor sharp, ears begin to soften. Rule of thirds — subject offset left. Creamy bokeh background.
TEXTURE: Visible skin pores, individual eyelashes, linen weave texture, wisps of flyaway hair catching backlight.
</pattern>

<pattern name="90s-flash-photography">
SUBJECT: Group of friends at a house party, mid-laugh, holding red cups. Genuine candid moment — slightly chaotic framing.

CAMERA: Canon IXUS point-and-shoot / compact digital camera feel
SETTINGS: ISO 800, 1/60s with flash, auto white balance (flash)
LIGHTING: Hard direct on-camera flash with blown-out highlights on faces. Deep black shadows behind subjects. Red-eye effect. Flash falloff creating dark background.
COLOR: Early 2000s digital color — slightly oversaturated, warm skin tones from flash, cool ambient in background. Slight color fringing.
ENVIRONMENT: House party interior, cluttered background out of focus, fairy lights and posters visible.
COMPOSITION: Slightly off-center, amateur framing — part of someone's head cut off at edge. Close range flash distance. Medium shot, waist-up.
TEXTURE: Flash-smoothed skin, glossy highlights on foreheads, visible jpeg compression artifacts, slight noise in shadows.
</pattern>

<pattern name="architectural-golden-hour">
SUBJECT: Modern concrete and glass museum building with dramatic cantilever overhang. Clean brutalist lines.

CAMERA: Canon EOS R5 + 24mm f/1.4 tilt-shift
SETTINGS: ISO 100, 1/125s, 5500K daylight WB
LIGHTING: Golden hour side-light from camera-right. Long shadows across the concrete facade. Warm light on the building, cool blue sky. No artificial lighting.
COLOR: High dynamic range, calibrated color grading. Warm golden tones on sunlit surfaces, cool shadows. Cinematic contrast ratio.
ENVIRONMENT: Architectural plaza, late afternoon, clear sky with wispy cirrus clouds. Reflection pool in foreground mirroring the building.
COMPOSITION: Wide angle 24mm with tilt correction for vertical lines. Leading lines from reflection pool to building. One-third sky, two-thirds architecture. Deep DOF f/11.
TEXTURE: Raw concrete surface detail — form marks, aggregate texture. Glass reflections of clouds. Wet stone near the pool edge. Crisp edge definition.
</pattern>

<pattern name="macro-nature">
SUBJECT: A single dewdrop on a spider web strand at dawn. Inside the droplet: a refracted, inverted image of a wildflower meadow.

CAMERA: Hasselblad H6D-100c + 120mm f/4 Macro
SETTINGS: ISO 200, 1/250s, 5800K daylight
LIGHTING: Backlit by early morning sun — dewdrop glows as a tiny lens. Soft ambient fill from overcast sky above. Volumetric mist in background catching godray beams.
COLOR: High saturation naturals — emerald greens, violet wildflowers, golden morning light. No filter. True-to-life color science.
ENVIRONMENT: English countryside meadow, dawn, light mist. Shallow focus isolates the web strand.
COMPOSITION: Extreme macro, 1:1 reproduction ratio. Dewdrop center frame, razor-thin DOF. Web strands radiate outward creating leading lines. Background: creamy bokeh of out-of-focus flowers.
TEXTURE: Water surface tension visible on the droplet. Individual silk strands of the web. Microdetails: pollen particles, tiny water beads on web nodes.
</pattern>
</patterns>

<nano-banana-2-features>
Nano Banana 2 has unique capabilities — use them when targeting NB2:
- REFERENCE IMAGES: Supports up to 14 refs (10 object + 5 character). When user has reference images, add: "Maintain the exact style/subject/lighting from reference image(s)."
- TEXT RENDERING: NB2 renders legible text in images. For infographics, menus, magazine covers: specify exact text content, placement, font style, and size.
- SEARCH GROUNDING: For real products/places/events, add: "Use web search grounding for factual visual accuracy."
- EDITING MODE: NB2 can edit existing images. Structure edit prompts as instructions: "Change the background to...", "Add a rim light from behind", "Shift the color grade to Cinestill 800T."
- RESOLUTION: Offer 4K for hero/print shots, 2K for social/web, 1K for quick iterations.
- THINKING MODE: NB2 reasons about spatial relationships and lighting physics — the more precise your specs, the better it performs.
</nano-banana-2-features>

<tips>
- ALWAYS specify camera body + exact lens (e.g. "Sony A7III + 85mm f/1.4")
- Include ISO, shutter speed, and aperture — these enforce realistic volumetric depth
- Film stock references (Kodak Portra 400, Cinestill 800T, Fuji Superia) give instant mood
- Describe lighting like a gaffer: key light position, fill ratio, rim/hair, practicals
- Texture keywords matter: "visible pores", "fabric weave", "brushed metal grain"
- For vintage looks: mention the specific camera era (2000s digital, 35mm film, Polaroid)
- Nano Banana 2 handles camera specs better than any model — be maximally specific
- Use negative space descriptions: "clean background with subtle gradient"
- For character consistency: "use reference images to maintain subject identity across multiple generations"
- For text-heavy designs (menus, posters): specify exact text, font, size, and placement
</tips>
</recipe>
`;
