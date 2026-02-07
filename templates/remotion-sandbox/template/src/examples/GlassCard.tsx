/**
 * GlassCard — Glassmorphism card with animated border
 *
 * Demonstrates:
 * - Glassmorphism (backdrop-filter blur + semi-transparent bg)
 * - Animated conic-gradient border rotation
 * - Staggered content entry (icon → title → body → CTA)
 * - Spring physics for scale entrance
 * - Layered shadows for depth
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

const FeatureRow: React.FC<{
  icon: string;
  label: string;
  delay: number;
}> = ({ icon, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.5 },
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: progress,
        transform: `translateX(${(1 - progress) * 20}px)`,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: '#CBD5E1',
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const GlassCard: React.FC<{
  title?: string;
  features?: Array<{ icon: string; label: string }>;
  accentColor?: string;
}> = ({
  title = 'Pro Features',
  features = [
    { icon: '⚡', label: 'Lightning-fast rendering' },
    { icon: '🎨', label: 'Premium design system' },
    { icon: '📦', label: 'One-click export' },
    { icon: '🔒', label: 'Enterprise security' },
  ],
  accentColor = '#8B5CF6',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card entrance
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
  });
  const cardOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Animated border rotation
  const borderRotation = (frame * 1.5) % 360;

  // Title entrance
  const titleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(145deg, #0A0A10 0%, #12121E 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 500,
          background: `radial-gradient(circle, ${accentColor}20 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      <div
        style={{
          opacity: cardOpacity,
          transform: `scale(${0.85 + cardScale * 0.15})`,
        }}
      >
        {/* Animated gradient border */}
        <div
          style={{
            position: 'relative',
            padding: 1.5,
            borderRadius: 24,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 24,
              background: `conic-gradient(from ${borderRotation}deg, ${accentColor}, #22D3EE, ${accentColor}80, ${accentColor})`,
              opacity: 0.6,
            }}
          />

          {/* Glass card body */}
          <div
            style={{
              position: 'relative',
              background: 'rgba(15, 15, 25, 0.9)',
              backdropFilter: 'blur(24px)',
              borderRadius: 22,
              padding: '40px 44px',
              width: 380,
              boxShadow: `
                0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.05)
              `,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#F1F5F9',
                fontFamily: "'Inter', -apple-system, sans-serif",
                letterSpacing: '-0.01em',
                marginBottom: 28,
                opacity: titleProgress,
                transform: `translateY(${(1 - titleProgress) * 10}px)`,
              }}
            >
              {title}
            </div>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {features.map((f, i) => (
                <FeatureRow
                  key={i}
                  icon={f.icon}
                  label={f.label}
                  delay={20 + i * 8}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
