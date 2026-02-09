/**
 * Recipe: Particle Systems
 *
 * Points geometry, spawn/lifetime/velocity, confetti, snow, dust.
 * ~2K tokens when injected.
 */

export const PARTICLE_SYSTEMS_RECIPE = `
<recipe name="particle-systems">
<title>Particle Systems</title>
<description>2D/3D particle effects: confetti, snow, dust, sparks, ambient floating particles.</description>

<patterns>
<pattern name="ambient-particles-2d">
Floating particles with random positions, sizes, and slow drift.
\`\`\`tsx
const PARTICLE_COUNT = 50;
const particles = useMemo(() =>
  Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x: Math.random() * 1920,
    y: Math.random() * 1080,
    size: 2 + Math.random() * 4,
    speed: 0.3 + Math.random() * 0.7,
    opacity: 0.1 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
  })),
[]);

{particles.map((p, i) => {
  const y = p.y - (frame * p.speed) % 1200;
  const x = p.x + Math.sin(frame * 0.02 + p.phase) * 20;
  return (
    <div key={i} style={{
      position: 'absolute',
      left: x,
      top: y < -10 ? y + 1200 : y,
      width: p.size,
      height: p.size,
      borderRadius: '50%',
      background: 'white',
      opacity: p.opacity,
    }} />
  );
})}
\`\`\`
</pattern>

<pattern name="confetti-burst">
Confetti explosion with gravity, rotation, and color variety.
\`\`\`tsx
const CONFETTI_COUNT = 80;
const confetti = useMemo(() =>
  Array.from({ length: CONFETTI_COUNT }, () => ({
    x: 960 + (Math.random() - 0.5) * 200,
    vx: (Math.random() - 0.5) * 15,
    vy: -8 - Math.random() * 12,
    color: ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD'][Math.floor(Math.random()*6)],
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 10,
    size: 6 + Math.random() * 8,
  })),
[]);

const gravity = 0.3;
const burstFrame = 30; // frame when confetti starts
const elapsed = Math.max(0, frame - burstFrame);

{elapsed > 0 && confetti.map((c, i) => {
  const x = c.x + c.vx * elapsed;
  const y = 540 + c.vy * elapsed + 0.5 * gravity * elapsed * elapsed;
  const rot = c.rotation + c.rotSpeed * elapsed;
  const opacity = interpolate(elapsed, [0, 90], [1, 0], { extrapolateRight: 'clamp' });
  return (
    <div key={i} style={{
      position: 'absolute', left: x, top: y,
      width: c.size, height: c.size * 0.6,
      background: c.color,
      transform: \`rotate(\${rot}deg)\`,
      opacity,
      borderRadius: 2,
    }} />
  );
})}
\`\`\`
</pattern>

<pattern name="particles-3d-three">
Three.js Points geometry for 3D particle fields (use with @remotion/three).
\`\`\`tsx
import { ThreeCanvas } from '@remotion/three';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const positions = useMemo(() => {
  const pos = new Float32Array(1000 * 3);
  for (let i = 0; i < 1000; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  return pos;
}, []);

<ThreeCanvas width={1920} height={1080} camera={{ position: [0, 0, 5], fov: 75 }}>
  <Points positions={positions} stride={3}>
    <PointMaterial size={0.05} color="#8B5CF6" transparent opacity={0.6} sizeAttenuation />
  </Points>
</ThreeCanvas>
\`\`\`
</pattern>
<pattern name="ripple">
Concentric expanding circles — radar ping, sonar, emphasis pulse. Frame-synced.
\`\`\`tsx
const NUM_RINGS = 8;
const mainSize = 210;
const cx = 960; // center x
const cy = 540; // center y

{Array.from({ length: NUM_RINGS }, (_, i) => {
  const baseSize = mainSize + i * 70;
  const delay = i * 4; // stagger in frames
  const elapsed = Math.max(0, frame - delay);
  const scale = interpolate(elapsed % 60, [0, 30, 60], [1, 0.92, 1], { extrapolateRight: 'clamp' });
  const opacity = interpolate(i, [0, NUM_RINGS - 1], [0.24, 0.03]);

  return (
    <div key={i} style={{
      position: 'absolute',
      width: baseSize,
      height: baseSize,
      left: cx - baseSize / 2,
      top: cy - baseSize / 2,
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.2)',
      background: 'rgba(255,255,255,0.03)',
      opacity,
      transform: \`scale(\${scale})\`,
      boxShadow: '0 4px 30px rgba(0,0,0,0.1)',
    }} />
  );
})}
\`\`\`
</pattern>
</patterns>

<tips>
- useMemo for particle arrays — never regenerate per frame
- Wrap in overflow: hidden container to clip off-screen particles
- Combine with blur for depth: closer particles larger + sharper, far particles smaller + blurred
- For snow: slow vy (0.5-2), gentle horizontal sine drift, white/blue colors
- For sparks: fast vy (-10 to -20), short lifetime (30-60 frames), warm colors
- 3D particles via @remotion/three + Points geometry for best performance
</tips>
</recipe>
`;
