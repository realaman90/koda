/**
 * Recipe: NanoBanana Product Photography
 *
 * Luxury product shots, floating objects, split-view renders,
 * e-commerce studio, and fashion lookbooks.
 * Source: awesome-nanobanana-pro (CC BY 4.0)
 * ~1.6K tokens when injected.
 */

export const NANOBANANA_PRODUCT_RECIPE = `
<recipe name="nanobanana-product">
<title>Product & E-commerce (NanoBanana)</title>
<description>Professional product photography — luxury floating shots, studio lighting, e-commerce white backgrounds, fashion lookbooks. Optimized for Nano Banana Pro and Nano Banana 2.</description>

<prompt-format>
Structure product photography prompts with:

PRODUCT: [exact description, material, color, size context]
STYLE: [luxury/editorial/e-commerce/lifestyle]
CAMERA: [body + lens], [aperture for DOF control]
LIGHTING: [key + fill + rim setup, softboxes, reflectors]
SURFACE: [what the product sits on or floats above]
BACKGROUND: [color, gradient, environment]
PROPS: [complementary elements, not competing]
POST: [color grade, retouching style]
</prompt-format>

<patterns>
<pattern name="luxury-floating">
PRODUCT: Matte black premium headphones with rose gold accents. Leather ear cushions, braided cable.

STYLE: Luxury editorial — floating in space
CAMERA: Phase One IQ4 + 120mm f/2.8 Macro, medium format
LIGHTING: Three-point lighting: large octabox key at 11 o'clock (soft, wrapping), strip softbox rim from behind-right (edge separation), white bounce fill from below. Narrow beam spotlight on the rose gold accent creating a hot specular highlight.
SURFACE: Floating — no visible support. Subtle shadow on invisible surface below for grounding.
BACKGROUND: Deep charcoal gradient, darkening at edges. Clean, no distractions.
PROPS: Floating rose gold dust particles catching the rim light. Subtle.
POST: High-end retouching. Perfect surface — no dust, no fingerprints. Micro-contrast boost on textures. Deep blacks, controlled highlights.
</pattern>

<pattern name="ecommerce-white">
PRODUCT: White minimalist sneaker, leather upper, gum sole. Clean design, visible stitching detail.

STYLE: E-commerce studio — Amazon/Shopify ready
CAMERA: Canon EOS R5 + 70-200mm f/2.8 at 100mm
LIGHTING: Global illumination — soft, nondirectional. Large white cyclorama wrapping 270 degrees. Overhead softbox for even fill. Small accent strip from behind for edge definition. No harsh shadows.
SURFACE: Pure white infinity curve (cyclorama). Seamless, no horizon line.
BACKGROUND: #FFFFFF pure white, even exposure.
PROPS: None. Product only.
POST: Background knockout ready. True-to-color calibration. No artistic grading — accurate product representation. Crisp detail at 100% zoom.
</pattern>

<pattern name="fashion-lookbook">
PRODUCT: Structured camel wool coat, oversized fit. Double-breasted with horn buttons.

STYLE: Fashion editorial lookbook
CAMERA: Sony A7III + 50mm f/1.8, vertical crop 3:4
LIGHTING: Natural light from large warehouse windows camera-left. Soft, directional. Fill from white concrete floor bounce. No artificial light — editorial authenticity. Warm 4500K ambient.
SURFACE: Model standing on polished concrete floor.
BACKGROUND: Industrial warehouse — exposed brick, steel beams, natural light streaming through high windows. Desaturated, doesn't compete with product.
PROPS: Model in minimal styling — slicked hair, no jewelry, neutral makeup. Coat is the hero.
POST: Kodak Portra 400 grade. Lifted blacks, creamy highlights. Subtle film grain. Warm midtones. Fashion-mag-ready.
</pattern>

<pattern name="food-hero-shot">
PRODUCT: Artisan sourdough bread, freshly sliced. Golden crust, open crumb structure visible.

STYLE: Food editorial — rustic premium
CAMERA: Canon EOS R5 + 100mm f/2.8 Macro
LIGHTING: Single key: large window light from behind-left (backlit, hero glow on crust edge). White bounce card camera-right for fill. Steam from the bread catching the backlight — volumetric.
SURFACE: Weathered oak cutting board on dark slate countertop.
BACKGROUND: Dark moody kitchen, shallow DOF blur. Copper pots, herbs, flour dust visible in the light beam.
PROPS: Linen napkin, vintage bread knife, small dish of butter with knife mark. Scattered flour dust.
POST: Warm, appetizing grade. Boosted oranges and golds. Deep, moody shadows. Crisp texture on the crust. Steam enhanced slightly.
</pattern>
</patterns>

<tips>
- For e-commerce: specify "pure white background" and "true-to-color" — no artistic grading
- For luxury: floating products need "subtle shadow for grounding" to avoid looking pasted
- Always describe material qualities: "matte", "glossy", "brushed metal", "leather grain"
- Lighting setups should match the product material: soft for matte, hard for glossy reflections
- Specify the surface/pedestal: marble, wood, acrylic, invisible (floating)
- Food photography: always include backlight for steam/texture glow
- Fashion: model should not compete with the product — minimal styling
- Include retouching expectations: "dust-free", "color-calibrated", "skin retouched but natural"
- NB2 REFERENCE IMAGES: For product line consistency, use reference images to maintain exact product appearance across angles/scenes
- NB2 TEXT: For packaging/labels with text, specify exact text content — NB2 renders legible typography
- NB2 EDITING: To tweak an existing product shot, use edit mode: "Change the background to marble", "Add a warm rim light"
</tips>
</recipe>
`;
