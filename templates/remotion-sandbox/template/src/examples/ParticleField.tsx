/**
 * ParticleField — Ambient floating particles for depth
 *
 * Demonstrates:
 * - Deterministic random (seeded from index) for reproducible renders
 * - Sine-based floating motion without CSS animations
 * - Frame-driven opacity pulse
 * - Layered particle sizes for depth-of-field illusion
 * - Composable as a background layer in any scene
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  opacity: number;
}

/** Simple seeded random for deterministic particle positions */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateParticles(count: number, width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: seededRandom(i * 3 + 1) * width,
      y: seededRandom(i * 3 + 2) * height,
      size: 1.5 + seededRandom(i * 3 + 3) * 3,
      speed: 0.3 + seededRandom(i * 7) * 0.7,
      phase: seededRandom(i * 11) * Math.PI * 2,
      opacity: 0.15 + seededRandom(i * 13) * 0.35,
    });
  }
  return particles;
}

export const ParticleField: React.FC<{
  count?: number;
  color?: string;
  width?: number;
  height?: number;
}> = ({
  count = 60,
  color = '#6366F1',
  width = 1920,
  height = 1080,
}) => {
  const frame = useCurrentFrame();
  const particles = React.useMemo(
    () => generateParticles(count, width, height),
    [count, width, height],
  );

  // Fade in the entire field
  const fieldOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: fieldOpacity }}>
      {particles.map((p, i) => {
        const floatY = Math.sin(frame * 0.02 * p.speed + p.phase) * 15;
        const floatX = Math.cos(frame * 0.015 * p.speed + p.phase * 0.7) * 8;
        const pulse = 0.7 + Math.sin(frame * 0.03 + p.phase) * 0.3;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + floatX,
              top: p.y + floatY,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: p.opacity * pulse,
              boxShadow: p.size > 3
                ? `0 0 ${p.size * 3}px ${color}40`
                : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
