/**
 * Recipe: Compositing
 *
 * Layer blending, masking, chroma key, light leaks.
 * ~1.5K tokens when injected.
 */

export const COMPOSITING_RECIPE = `
<recipe name="compositing">
<title>Compositing</title>
<description>Layer blending modes, masking, light leaks, vignettes, color grading.</description>

<patterns>
<pattern name="blend-modes">
Layer compositing using CSS mix-blend-mode.
\`\`\`tsx
<div style={{ position: 'relative', width: 1920, height: 1080 }}>
  {/* Base layer */}
  <div style={{ position: 'absolute', inset: 0 }}>
    {baseContent}
  </div>
  {/* Color overlay — multiply for darkening, screen for lightening */}
  <div style={{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(135deg, #1E1B4B, #7C3AED)',
    mixBlendMode: 'multiply',
    opacity: 0.6,
  }} />
  {/* Light overlay */}
  <div style={{
    position: 'absolute', inset: 0,
    background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.3), transparent 60%)',
    mixBlendMode: 'screen',
  }} />
</div>
\`\`\`
</pattern>

<pattern name="light-leak">
Animated light leak / lens flare overlay.
\`\`\`tsx
const leakProgress = interpolate(frame, [startFrame, startFrame + 45], [0, 1], { extrapolateRight: 'clamp' });
const leakX = interpolate(leakProgress, [0, 1], [-200, 1920]);
const leakOpacity = interpolate(leakProgress, [0, 0.3, 0.7, 1], [0, 0.8, 0.8, 0]);

<div style={{
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
  background: \`radial-gradient(ellipse 300px 800px at \${leakX}px 50%, rgba(255,200,100,\${leakOpacity}), transparent)\`,
  mixBlendMode: 'screen',
}} />
\`\`\`
</pattern>

<pattern name="vignette">
Classic dark-edge vignette.
\`\`\`tsx
<div style={{
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50,
  background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, rgba(0,0,0,0.7) 100%)',
}} />
\`\`\`
</pattern>

<pattern name="color-grading">
Film color grading using CSS filters.
\`\`\`tsx
// Cinematic warm
<div style={{ filter: 'contrast(1.1) saturate(1.2) brightness(0.95) sepia(0.1)' }}>
  {content}
</div>

// Cool/cyberpunk
<div style={{ filter: 'contrast(1.2) saturate(0.8) brightness(1.05) hue-rotate(10deg)' }}>
  {content}
</div>

// Vintage film
<div style={{ filter: 'contrast(0.9) saturate(0.7) brightness(1.1) sepia(0.3)' }}>
  {content}
</div>
\`\`\`
</pattern>

<pattern name="mask-composition">
Use clip-path to composite content into shapes.
\`\`\`tsx
// Text-shaped mask — content visible only through text
<div style={{
  position: 'relative',
  fontSize: 200, fontWeight: 900,
  background: 'url(/media/texture.jpg)',
  backgroundSize: 'cover',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}}>
  MASK
</div>

// Animated circle mask expanding
const maskSize = interpolate(frame, [0, 60], [0, 150], { extrapolateRight: 'clamp' });
<div style={{ clipPath: \`circle(\${maskSize}% at 50% 50%)\` }}>
  {content}
</div>
\`\`\`
</pattern>
<pattern name="retro-grid">
Animated perspective grid — vaporwave/retro background. Frame-synced scrolling.
\`\`\`tsx
const gridScroll = interpolate(frame, [0, durationInFrames], [0, 100]);
const cellSize = 60;
const angle = 65; // degrees of perspective tilt
const lineColor = 'rgba(128,128,128,0.4)';

<div style={{ position: 'absolute', inset: 0, overflow: 'hidden', perspective: 200 }}>
  {/* Tilted grid plane */}
  <div style={{
    position: 'absolute', inset: 0,
    transform: \`rotateX(\${angle}deg)\`,
  }}>
    <div style={{
      marginLeft: '-200%',
      width: '600vw',
      height: '300vh',
      transformOrigin: '100% 0 0',
      backgroundImage: \`linear-gradient(to right, \${lineColor} 1px, transparent 0), linear-gradient(to bottom, \${lineColor} 1px, transparent 0)\`,
      backgroundSize: \`\${cellSize}px \${cellSize}px\`,
      backgroundPosition: \`0 \${gridScroll}%\`,
    }} />
  </div>
  {/* Bottom fade */}
  <div style={{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to top, #0a0a0a 0%, transparent 90%)',
  }} />
</div>
\`\`\`
</pattern>
</patterns>

<tips>
- Layer order matters: base → color grade → overlays → light leaks → vignette
- Blend modes: screen (lighten), multiply (darken), overlay (contrast), soft-light (subtle)
- Light leaks should be SHORT (20-40 frames) and used sparingly
- Vignette adds instant cinematic quality — always consider adding one
- Color grading via CSS filter is fast and composable
- For complex masking: use SVG clipPath with animated paths
</tips>
</recipe>
`;
