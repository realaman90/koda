/**
 * SplitReveal — Editorial/Apple-style split-screen reveal
 *
 * Demonstrates:
 * - Split layout: 50/50 with independent animations per side
 * - Warm color palette (amber/brown) — non-cool-tone aesthetics
 * - Large editorial typography (100px headline, tight letter-spacing)
 * - Eyebrow text pattern (small caps, accent color, above headline)
 * - Spring physics for slide and scale entrances
 * - Warm gradient wash across the split line
 * - Staggered content: eyebrow -> headline -> body -> right panel
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

export const SplitReveal: React.FC<{
  eyebrow?: string;
  headline?: string;
  body?: string;
  accentColor?: string;
  backgroundColor?: string;
  panelColor?: string;
}> = ({
  eyebrow = 'Introducing',
  headline = 'Design\nWithout\nLimits',
  body = 'A creative platform that adapts to the way you think, not the other way around.',
  accentColor = '#F59E0B',
  backgroundColor = '#1C1917',
  panelColor = '#292524',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Left side: text content ---

  // Eyebrow entrance (first)
  const eyebrowDelay = 8;
  const eyebrowSpring = spring({
    frame: frame - eyebrowDelay,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.5 },
  });
  const eyebrowX = interpolate(eyebrowSpring, [0, 1], [-40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Headline entrance (staggered after eyebrow)
  const headlineDelay = 18;
  const headlineSpring = spring({
    frame: frame - headlineDelay,
    fps,
    config: { damping: 16, stiffness: 80, mass: 0.8 },
  });
  const headlineX = interpolate(headlineSpring, [0, 1], [-60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Body text entrance (last on left)
  const bodyDelay = 40;
  const bodyOpacity = spring({
    frame: frame - bodyDelay,
    fps,
    config: { damping: 24, stiffness: 80 },
  });
  const bodyY = interpolate(bodyOpacity, [0, 1], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Right side: colored panel ---
  const panelDelay = 25;
  const panelSpring = spring({
    frame: frame - panelDelay,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.9 },
  });
  const panelScale = interpolate(panelSpring, [0, 1], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Gradient wash across the center ---
  const washOpacity = interpolate(frame, [15, 50], [0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Decorative accent line on left edge of right panel ---
  const lineHeight = interpolate(frame, [30, 70], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
      }}
    >
      {/* Warm ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '40%',
          width: 500,
          height: 500,
          background: `radial-gradient(circle, ${accentColor}12 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Split container */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Left half: text content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: 100,
            paddingRight: 60,
          }}
        >
          {/* Eyebrow text */}
          <div
            style={{
              opacity: eyebrowSpring,
              transform: `translateX(${eyebrowX}px)`,
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.16em',
              color: accentColor,
              fontFamily: "'Inter', -apple-system, sans-serif",
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </div>

          {/* Headline */}
          <div
            style={{
              opacity: headlineSpring,
              transform: `translateX(${headlineX}px)`,
              fontSize: 100,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              color: '#FAFAF9',
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
              marginBottom: 28,
              whiteSpace: 'pre-line',
            }}
          >
            {headline}
          </div>

          {/* Body text */}
          <div
            style={{
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
              fontSize: 18,
              fontWeight: 400,
              lineHeight: 1.6,
              color: '#A8A29E',
              fontFamily: "'Inter', -apple-system, sans-serif",
              maxWidth: 420,
            }}
          >
            {body}
          </div>
        </div>

        {/* Center gradient wash */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '48%',
            width: 120,
            background: `linear-gradient(180deg, transparent 0%, ${accentColor}${Math.round(washOpacity * 30).toString(16).padStart(2, '0')} 50%, transparent 100%)`,
            filter: 'blur(40px)',
          }}
        />

        {/* Right half: visual panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* Accent line on the left edge */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 2,
              height: `${lineHeight}%`,
              background: `linear-gradient(180deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
              opacity: 0.5,
            }}
          />

          {/* Panel placeholder (represents image area) */}
          <div
            style={{
              opacity: panelSpring,
              transform: `scale(${panelScale})`,
              width: '75%',
              height: '65%',
              borderRadius: 20,
              background: `linear-gradient(145deg, ${panelColor} 0%, #1C1917 100%)`,
              border: '1px solid rgba(245, 158, 11, 0.12)',
              boxShadow: `
                0 8px 32px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.03)
              `,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Inner decorative grid */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(rgba(245, 158, 11, 0.04) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(245, 158, 11, 0.04) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />

            {/* Centered accent shape */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)`,
                border: `1px solid ${accentColor}25`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: `${accentColor}40`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
