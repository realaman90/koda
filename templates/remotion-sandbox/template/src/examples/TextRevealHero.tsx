/**
 * TextRevealHero — Premium text reveal animation
 *
 * Demonstrates:
 * - Character-by-character text reveal with spring physics
 * - Gradient text via WebkitBackgroundClip
 * - Radial glow background effect
 * - Staggered subtitle fade-in
 * - Sequence-based scene timing
 */
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

const CharReveal: React.FC<{
  text: string;
  startFrame?: number;
  staggerFrames?: number;
  fontSize?: number;
  gradient?: string;
}> = ({
  text,
  startFrame = 0,
  staggerFrames = 2,
  fontSize = 96,
  gradient = 'linear-gradient(135deg, #FFFFFF 0%, #94A3B8 100%)',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
        fontSize,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
      }}
    >
      {text.split('').map((char, i) => {
        const charDelay = startFrame + i * staggerFrames;
        const progress = spring({
          frame: frame - charDelay,
          fps,
          config: { damping: 12, stiffness: 120, mass: 0.5 },
        });
        const y = interpolate(progress, [0, 1], [40, 0]);

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: progress,
              transform: `translateY(${y}px)`,
              background: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        );
      })}
    </div>
  );
};

export const TextRevealHero: React.FC<{
  title?: string;
  subtitle?: string;
  accentColor?: string;
}> = ({
  title = 'Ship Faster',
  subtitle = 'The modern platform for creative teams',
  accentColor = '#6366F1',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtitle fades in after title finishes
  const subtitleDelay = title.length * 2 + 20;
  const subtitleOpacity = spring({
    frame: frame - subtitleDelay,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0A0A0F 0%, #111118 50%, #0A0A0F 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Radial glow behind text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 700,
          height: 700,
          background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div style={{ position: 'relative', textAlign: 'center' }}>
        <Sequence from={0}>
          <CharReveal
            text={title}
            fontSize={120}
            gradient={`linear-gradient(135deg, #FFFFFF 0%, ${accentColor} 100%)`}
          />
        </Sequence>

        <div
          style={{
            marginTop: 24,
            opacity: subtitleOpacity,
            transform: `translateY(${(1 - subtitleOpacity) * 12}px)`,
            fontSize: 28,
            fontWeight: 400,
            color: '#64748B',
            fontFamily: "'Inter', -apple-system, sans-serif",
            letterSpacing: '0.01em',
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
