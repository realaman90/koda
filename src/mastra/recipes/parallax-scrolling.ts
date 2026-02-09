/**
 * Recipe: Parallax Scrolling
 *
 * Multi-layer depth, speed ratios, scroll-linked transforms.
 * ~1K tokens when injected.
 */

export const PARALLAX_SCROLLING_RECIPE = `
<recipe name="parallax-scrolling">
<title>Parallax Scrolling</title>
<description>Multi-layer depth effects with different scroll speeds, creating illusion of depth.</description>

<patterns>
<pattern name="multi-layer-parallax">
Layers moving at different speeds based on frame progress.
\`\`\`tsx
const scroll = interpolate(frame, [0, durationInFrames], [0, 1]);

const layers = [
  { speed: 0.2, color: '#0F172A', elements: 'stars' },   // Far background (slowest)
  { speed: 0.5, color: '#1E293B', elements: 'mountains' }, // Mid
  { speed: 0.8, color: '#334155', elements: 'trees' },     // Near
  { speed: 1.0, color: '#475569', elements: 'ground' },    // Foreground (fastest)
];

{layers.map((layer, i) => (
  <div key={i} style={{
    position: 'absolute',
    inset: 0,
    transform: \`translateY(\${-scroll * layer.speed * 500}px)\`,
    zIndex: i,
  }}>
    {/* Layer content */}
  </div>
))}
\`\`\`
</pattern>

<pattern name="horizontal-parallax">
Side-scrolling parallax with repeating backgrounds.
\`\`\`tsx
const scrollX = interpolate(frame, [0, durationInFrames], [0, -3840]); // 2x width

<div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
  {/* Background layer — slow */}
  <div style={{
    position: 'absolute', width: 3840, height: 1080,
    transform: \`translateX(\${scrollX * 0.3}px)\`,
    background: 'linear-gradient(90deg, #0F172A, #1E1B4B, #0F172A)',
  }} />
  {/* Midground — medium */}
  <div style={{
    position: 'absolute', width: 3840, height: 1080,
    transform: \`translateX(\${scrollX * 0.6}px)\`,
  }}>
    {/* Content elements */}
  </div>
  {/* Foreground — fast */}
  <div style={{
    position: 'absolute', width: 3840, height: 1080,
    transform: \`translateX(\${scrollX}px)\`,
  }}>
    {/* Content elements */}
  </div>
</div>
\`\`\`
</pattern>
</patterns>

<tips>
- Speed ratios: background 0.1-0.3, midground 0.4-0.6, foreground 0.8-1.0
- Add blur to far layers: filter: \`blur(\${(1 - speed) * 3}px)\` for depth of field
- Use opacity gradients at edges to fade layers in/out
- Combine with scale: distant layers slightly smaller for perspective
- For infinite scroll: use modulo on position and repeat content
</tips>
</recipe>
`;
