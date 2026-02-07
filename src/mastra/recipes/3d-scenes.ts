/**
 * Recipe: 3D Scenes
 *
 * ThreeCanvas, orbit camera, lighting, reflections, environment maps.
 * ~2K tokens when injected.
 */

export const THREE_D_SCENES_RECIPE = `
<recipe name="3d-scenes">
<title>3D Scenes</title>
<description>Three.js scenes inside Remotion using @remotion/three: cameras, lighting, materials, environment maps.</description>

<patterns>
<pattern name="basic-threeccanvas">
Remotion + Three.js setup with animated camera.
\`\`\`tsx
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { OrbitControls, Environment, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

export const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const rotation = interpolate(frame, [0, durationInFrames], [0, Math.PI * 2]);
  const cameraY = interpolate(frame, [0, durationInFrames], [3, 1]);

  return (
    <ThreeCanvas
      width={1920}
      height={1080}
      camera={{ position: [5, cameraY, 5], fov: 50 }}
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 100%)' }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-3, 2, -3]} color="#8B5CF6" intensity={2} />
      <mesh rotation={[0, rotation, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#6366F1" metalness={0.8} roughness={0.2} />
      </mesh>
      <Environment preset="city" />
    </ThreeCanvas>
  );
};
\`\`\`
</pattern>

<pattern name="cobe-globe">
Interactive-style globe using cobe (5KB WebGL). Best for data visualization, hero backgrounds, tech dashboards.
\`\`\`tsx
import { useCurrentFrame, useVideoConfig, interpolate, Img } from 'remotion';
import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

export const CobeGlobe: React.FC<{ width?: number; height?: number }> = ({ width = 800, height = 800 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe>>();

  const phi = interpolate(frame, [0, durationInFrames], [0, Math.PI * 2]);

  useEffect(() => {
    if (!canvasRef.current) return;
    globeRef.current = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: height * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.1, 0.8, 1.0],
      glowColor: [0.1, 0.1, 0.2],
      markers: [
        { location: [37.7749, -122.4194], size: 0.05 },  // San Francisco
        { location: [51.5074, -0.1278], size: 0.05 },    // London
        { location: [35.6762, 139.6503], size: 0.05 },   // Tokyo
        { location: [-33.8688, 151.2093], size: 0.04 },  // Sydney
      ],
      onRender: () => {},
    });
    return () => { globeRef.current?.destroy(); };
  }, []);

  // Update rotation each frame
  useEffect(() => {
    if (!canvasRef.current) return;
    globeRef.current?.destroy();
    globeRef.current = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: height * 2,
      phi,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.1, 0.8, 1.0],
      glowColor: [0.1, 0.1, 0.2],
      markers: [],
      onRender: () => {},
    });
    return () => { globeRef.current?.destroy(); };
  }, [frame]);

  return <canvas ref={canvasRef} width={width * 2} height={height * 2} style={{ width, height }} />;
};
\`\`\`
</pattern>

<pattern name="threejs-globe">
Three.js globe with texture — heavier but more customizable (materials, lighting, post-processing).
\`\`\`tsx
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';

const Globe: React.FC<{ rotation: number }> = ({ rotation }) => {
  return (
    <mesh rotation={[0.3, rotation, 0]}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial color="#1E40AF" metalness={0.3} roughness={0.7} />
    </mesh>
  );
};

// In main composition:
const frame = useCurrentFrame();
const rotation = interpolate(frame, [0, 300], [0, Math.PI * 2]);
<ThreeCanvas width={1920} height={1080} camera={{ position: [0, 0, 5], fov: 50 }}>
  <ambientLight intensity={0.4} />
  <directionalLight position={[5, 3, 5]} intensity={1.5} />
  <Globe rotation={rotation} />
</ThreeCanvas>
\`\`\`
</pattern>

<pattern name="glass-material">
Glassmorphism / transmission material for premium 3D look.
\`\`\`tsx
import { MeshTransmissionMaterial } from '@react-three/drei';

<mesh>
  <sphereGeometry args={[1.5, 64, 64]} />
  <MeshTransmissionMaterial
    backside
    samples={16}
    thickness={0.2}
    chromaticAberration={0.06}
    anisotropy={0.1}
    distortion={0.1}
    distortionScale={0.3}
    temporalDistortion={0}
    color="#ffffff"
  />
</mesh>
\`\`\`
</pattern>
</patterns>

<tips>
- For globes: prefer cobe (5KB, zero deps) for clean dotted globes with markers. Use Three.js globe only when you need custom materials/lighting/post-processing.
- cobe globe: create/destroy each frame to sync with Remotion's frame-based rendering. The onRender callback is unused — phi controls rotation.
- ALWAYS import ThreeCanvas from '@remotion/three' (NOT React Three Fiber's Canvas)
- ThreeCanvas requires explicit width/height props matching composition dimensions
- Camera position is set via ThreeCanvas camera prop, NOT OrbitControls
- For textures: download at sandbox setup via \`curl -o public/texture.jpg URL\`
  - Earth textures: unpkg.com/three-globe/example/img/earth-blue-marble.jpg
  - HDRI environments: polyhaven.com (download .hdr files)
- Environment presets available: "sunset", "dawn", "night", "warehouse", "forest", "apartment", "studio", "city", "park", "lobby"
- Use interpolate() for smooth camera paths — NOT useFrame or requestAnimationFrame
- For performance: keep polygon count under 100K, use instanced meshes for repeated objects
</tips>
</recipe>
`;
