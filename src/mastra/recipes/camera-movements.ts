/**
 * Recipe: Camera Movements
 *
 * Dolly, crane, zoom, shake (spring-based), tracking.
 * ~1K tokens when injected.
 */

export const CAMERA_MOVEMENTS_RECIPE = `
<recipe name="camera-movements">
<title>Camera Movements</title>
<description>Cinematic camera techniques: dolly, crane, zoom, shake, tracking shots.</description>

<patterns>
<pattern name="dolly-zoom">
Dolly zoom (Vertigo effect) — camera moves while zoom adjusts.
\`\`\`tsx
// 2D simulation via scale + translateZ
const progress = interpolate(frame, [startFrame, startFrame + 90], [0, 1], { extrapolateRight: 'clamp' });
const scale = interpolate(progress, [0, 1], [1, 1.5]);
const translateY = interpolate(progress, [0, 1], [0, -100]);

<div style={{
  transform: \`scale(\${scale}) translateY(\${translateY}px)\`,
  transformOrigin: 'center 60%',
}}>
  {/* Scene content */}
</div>

// 3D version with ThreeCanvas:
const cameraZ = interpolate(frame, [0, 90], [8, 3]);
const fov = interpolate(frame, [0, 90], [30, 70]);
<ThreeCanvas camera={{ position: [0, 0, cameraZ], fov }} ... />
\`\`\`
</pattern>

<pattern name="camera-shake">
Spring-based camera shake for impact moments.
\`\`\`tsx
const shakeFrame = frame - impactFrame;
const shakeDecay = Math.exp(-shakeFrame * 0.1); // Exponential decay
const shakeX = shakeFrame > 0 ? Math.sin(shakeFrame * 1.5) * 8 * shakeDecay : 0;
const shakeY = shakeFrame > 0 ? Math.cos(shakeFrame * 2.1) * 6 * shakeDecay : 0;
const shakeRotation = shakeFrame > 0 ? Math.sin(shakeFrame * 1.8) * 2 * shakeDecay : 0;

<div style={{
  transform: \`translate(\${shakeX}px, \${shakeY}px) rotate(\${shakeRotation}deg)\`,
}}>
  {/* Scene content */}
</div>
\`\`\`
</pattern>

<pattern name="crane-shot">
Smooth vertical camera movement (crane up/down).
\`\`\`tsx
const craneProgress = spring({ frame: frame - startFrame, fps, config: { damping: 20, mass: 1.5 } });
const translateY = interpolate(craneProgress, [0, 1], [300, 0]); // Crane up
const scale = interpolate(craneProgress, [0, 1], [1.2, 1]); // Slight zoom out

<div style={{
  transform: \`translateY(\${translateY}px) scale(\${scale})\`,
  transformOrigin: 'center bottom',
}}>
  {/* Scene content */}
</div>
\`\`\`
</pattern>

<pattern name="tracking-shot-3d">
Camera following a path in 3D space.
\`\`\`tsx
// Camera orbiting around a point
const angle = interpolate(frame, [0, durationInFrames], [0, Math.PI * 2]);
const radius = 5;
const cameraX = Math.sin(angle) * radius;
const cameraZ = Math.cos(angle) * radius;
const cameraY = interpolate(frame, [0, durationInFrames], [3, 1.5]);

<ThreeCanvas camera={{ position: [cameraX, cameraY, cameraZ], fov: 50 }} ... >
  {/* Scene always at origin, camera orbits */}
</ThreeCanvas>
\`\`\`
</pattern>
</patterns>

<tips>
- For 2D: simulate camera with transform on a container div wrapping all content
- For 3D: animate ThreeCanvas camera prop using interpolate()
- Combine dolly + rotation for dynamic reveals
- Camera shake: always use exponential decay, never sustained shake
- Crane shots pair well with fade-in for dramatic intros
- For smooth paths: use cubic bezier interpolation between keypoints
</tips>
</recipe>
`;
