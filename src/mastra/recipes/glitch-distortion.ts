/**
 * Recipe: Glitch / Distortion
 *
 * RGB split, scan lines, noise, CRT effect.
 * ~1.5K tokens when injected.
 */

export const GLITCH_DISTORTION_RECIPE = `
<recipe name="glitch-distortion">
<title>Glitch & Distortion</title>
<description>RGB channel splitting, scan lines, digital noise, CRT effects, chromatic aberration.</description>

<patterns>
<pattern name="rgb-split">
Offset RGB channels for chromatic aberration / glitch effect.
\`\`\`tsx
const glitchIntensity = Math.random() > 0.85 ? 1 : 0; // Random glitch trigger
const offsetX = glitchIntensity * (Math.random() * 10 - 5);
const offsetY = glitchIntensity * (Math.random() * 6 - 3);

<div style={{ position: 'relative' }}>
  {/* Red channel */}
  <div style={{
    position: 'absolute', inset: 0,
    transform: \`translate(\${offsetX}px, \${offsetY}px)\`,
    mixBlendMode: 'screen',
    filter: 'url(#red-channel)',
  }}>{content}</div>
  {/* Green channel (base) */}
  <div style={{ position: 'relative' }}>{content}</div>
  {/* Blue channel */}
  <div style={{
    position: 'absolute', inset: 0,
    transform: \`translate(\${-offsetX}px, \${-offsetY}px)\`,
    mixBlendMode: 'screen',
    filter: 'url(#blue-channel)',
  }}>{content}</div>
</div>
\`\`\`
Note: For deterministic glitch, use a seeded random based on frame number instead of Math.random().
Use \`const seed = Math.sin(frame * 43758.5453) * 10000; const rand = seed - Math.floor(seed);\`
</pattern>

<pattern name="scan-lines">
CRT-style horizontal scan lines overlay.
\`\`\`tsx
const scanLineOffset = (frame * 2) % 4; // Animate scan line position

<div style={{
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
  background: \`repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.15) 2px,
    rgba(0,0,0,0.15) 4px
  )\`,
  backgroundPositionY: scanLineOffset,
  mixBlendMode: 'multiply',
}} />
\`\`\`
</pattern>

<pattern name="noise-overlay">
Animated noise texture using CSS gradients (no image required).
\`\`\`tsx
const noisePhase = frame * 100; // Changes noise pattern each frame

<div style={{
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
  opacity: 0.05,
  backgroundImage: \`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' seed='\${frame}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")\`,
  backgroundSize: '256px 256px',
}} />
\`\`\`
</pattern>

<pattern name="vhs-distortion">
VHS-style horizontal displacement bands.
\`\`\`tsx
const bands = useMemo(() =>
  Array.from({ length: 5 }, (_, i) => ({
    y: Math.random() * 1080,
    height: 2 + Math.random() * 20,
    offset: (Math.random() - 0.5) * 30,
    speed: 0.5 + Math.random() * 2,
  })),
[]);

{bands.map((band, i) => {
  const y = (band.y + frame * band.speed) % 1080;
  return (
    <div key={i} style={{
      position: 'absolute',
      left: band.offset, top: y,
      width: '100%', height: band.height,
      background: 'inherit',
      clipPath: \`inset(0 0 0 0)\`,
      transform: \`translateX(\${band.offset}px)\`,
    }} />
  );
})}
\`\`\`
</pattern>
</patterns>

<tips>
- Use deterministic pseudo-random based on frame for reproducible glitches
- Layer effects: scan lines + noise + occasional RGB split = convincing CRT
- Keep glitch effects intermittent (10-20% of frames) for best impact
- Combine with color grading: slight green/cyan tint for retro monitor look
- For chromatic aberration: offset red +2px left, blue +2px right
</tips>
</recipe>
`;
