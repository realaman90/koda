/**
 * Recipe: Logo Reveals
 *
 * Mask wipe, particle assembly, 3D flip, draw-on SVG stroke.
 * ~1.5K tokens when injected.
 */

export const LOGO_REVEALS_RECIPE = `
<recipe name="logo-reveals">
<title>Logo Reveals</title>
<description>Techniques for revealing logos and brand marks: mask wipes, particle assembly, SVG draw-on, 3D flips.</description>

<patterns>
<pattern name="svg-draw-on">
SVG stroke animation — logo draws itself on screen.
\`\`\`tsx
// Assumes logo SVG paths are available
const drawProgress = interpolate(frame, [startFrame, startFrame + 60], [0, 1], { extrapolateRight: 'clamp' });
const totalLength = 1000; // Measure with getTotalLength() or estimate

<svg viewBox="0 0 200 200" width={400} height={400}>
  <path
    d={logoPath}
    fill="none"
    stroke="#FAFAFA"
    strokeWidth={2}
    strokeDasharray={totalLength}
    strokeDashoffset={totalLength * (1 - drawProgress)}
    strokeLinecap="round"
  />
  {/* Fill fades in after stroke completes */}
  <path
    d={logoPath}
    fill="#FAFAFA"
    opacity={interpolate(frame, [startFrame + 50, startFrame + 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
    stroke="none"
  />
</svg>
\`\`\`
</pattern>

<pattern name="mask-wipe-reveal">
Circular or linear mask expanding to reveal the logo.
\`\`\`tsx
const revealProgress = spring({ frame: frame - startFrame, fps, config: { damping: 15, mass: 0.8 } });
const radius = revealProgress * 120; // percentage

<div style={{
  clipPath: \`circle(\${radius}% at 50% 50%)\`,
}}>
  <img src={staticFile('media/logo.png')} style={{ width: 300, height: 300 }} />
</div>
\`\`\`
</pattern>

<pattern name="particle-assembly">
Logo assembles from scattered particles into final form.
\`\`\`tsx
const PARTICLE_COUNT = 200;
const assembleProgress = spring({ frame: frame - startFrame, fps, config: { damping: 12, mass: 0.6 } });

const particles = useMemo(() =>
  Array.from({ length: PARTICLE_COUNT }, () => ({
    // Random starting position (scattered)
    startX: (Math.random() - 0.5) * 1920,
    startY: (Math.random() - 0.5) * 1080,
    // Final position (on logo grid — compute from logo shape)
    endX: (Math.random() - 0.5) * 200,
    endY: (Math.random() - 0.5) * 200,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.3, // stagger
  })),
[]);

{particles.map((p, i) => {
  const t = Math.max(0, Math.min(1, assembleProgress - p.delay));
  const x = p.startX + (p.endX - p.startX) * t;
  const y = p.startY + (p.endY - p.startY) * t;
  return (
    <div key={i} style={{
      position: 'absolute',
      left: '50%', top: '50%',
      transform: \`translate(\${x}px, \${y}px)\`,
      width: p.size, height: p.size,
      borderRadius: '50%',
      background: '#FAFAFA',
      opacity: 0.5 + t * 0.5,
    }} />
  );
})}
\`\`\`
</pattern>

<pattern name="3d-flip-reveal">
Logo flips in from behind (3D rotation).
\`\`\`tsx
const flipProgress = spring({ frame: frame - startFrame, fps, config: { damping: 14 } });
const rotateY = interpolate(flipProgress, [0, 1], [90, 0]);
const scale = interpolate(flipProgress, [0, 0.5, 1], [0.8, 1.1, 1]);

<div style={{
  transform: \`perspective(800px) rotateY(\${rotateY}deg) scale(\${scale})\`,
  backfaceVisibility: 'hidden',
  transformOrigin: 'center',
}}>
  <img src={staticFile('media/logo.png')} style={{ width: 300 }} />
</div>
\`\`\`
</pattern>
</patterns>

<tips>
- For SVG draw-on: user provides logo as SVG → extract path data
- For image logos: use mask/clip-path techniques (circle reveal, wipe)
- Always add subtle glow/shadow after reveal: \`filter: drop-shadow(0 0 30px rgba(255,255,255,0.3))\`
- Combine reveal with background animation (particles, gradient shift) for premium feel
- Logo reveal should be 2-4 seconds — not too fast, not too slow
- Add a subtle camera shake on "land" for impact
</tips>
</recipe>
`;
