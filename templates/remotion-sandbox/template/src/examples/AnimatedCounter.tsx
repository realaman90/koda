/**
 * AnimatedCounter — Dashboard/Fintech-style animated number counter
 *
 * Demonstrates:
 * - Number count-up using interpolate + Math.floor + toLocaleString
 * - Staggered entry: label -> number -> badge -> separator line
 * - Monospace font for numbers, sans-serif for labels
 * - Muted professional color palette (dark blue-gray + teal accent)
 * - Spring physics for badge slide-in
 * - Line draw animation using width interpolation
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

export const AnimatedCounter: React.FC<{
  targetValue?: number;
  prefix?: string;
  label?: string;
  changePercent?: number;
  accentColor?: string;
  backgroundColor?: string;
}> = ({
  targetValue = 1247893,
  prefix = '$',
  label = 'Total Revenue',
  changePercent = 12.5,
  accentColor = '#14B8A6',
  backgroundColor = '#0F172A',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Label entrance (appears first) ---
  const labelProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY = interpolate(labelProgress, [0, 1], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Number count-up (starts after label) ---
  const countStart = 20;
  const countDuration = 60;
  const rawCount = interpolate(
    frame,
    [countStart, countStart + countDuration],
    [0, targetValue],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const displayValue = Math.floor(rawCount);
  const formattedValue = `${prefix}${displayValue.toLocaleString()}`;

  const numberOpacity = interpolate(frame, [countStart - 5, countStart + 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Separator line draws left to right ---
  const lineDelay = 50;
  const lineProgress = interpolate(
    frame,
    [lineDelay, lineDelay + 40],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Percentage badge slides in from right ---
  const badgeDelay = 70;
  const badgeSpring = spring({
    frame: frame - badgeDelay,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.5 },
  });
  const badgeX = interpolate(badgeSpring, [0, 1], [60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Subtle ambient glow ---
  const glowPulse = 0.08 + Math.sin(frame * 0.03) * 0.03;

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Subtle top-right glow */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          right: '30%',
          width: 400,
          height: 400,
          background: `radial-gradient(circle, ${accentColor}${Math.round(glowPulse * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: 520,
        }}
      >
        {/* Label */}
        <div
          style={{
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            fontSize: 14,
            fontWeight: 500,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
            color: '#64748B',
            fontFamily: "'Inter', -apple-system, sans-serif",
            marginBottom: 12,
          }}
        >
          {label}
        </div>

        {/* Large number */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <div
            style={{
              opacity: numberOpacity,
              fontSize: 72,
              fontWeight: 700,
              color: '#F1F5F9',
              fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {formattedValue}
          </div>
        </div>

        {/* Separator line */}
        <div
          style={{
            width: '100%',
            height: 1,
            marginTop: 20,
            marginBottom: 16,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: 1,
              width: `${lineProgress}%`,
              background: `linear-gradient(90deg, ${accentColor}60, ${accentColor}20)`,
            }}
          />
        </div>

        {/* Percentage change badge */}
        <div
          style={{
            opacity: badgeSpring,
            transform: `translateX(${badgeX}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}40`,
              borderRadius: 8,
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {/* Up arrow */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <path
                d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5"
                stroke={accentColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: accentColor,
                fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              }}
            >
              +{changePercent}%
            </span>
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: '#475569',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            vs last month
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
