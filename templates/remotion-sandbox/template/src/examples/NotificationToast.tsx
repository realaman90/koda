/**
 * NotificationToast — SaaS notification with slide-in/out animation
 *
 * Demonstrates:
 * - Slide-in from right with spring physics (damping: 18, stiffness: 120)
 * - White/light card on dark background (contrast inversion)
 * - Avatar circle with gradient fill
 * - Staggered content reveal (title -> description -> timestamp)
 * - Progress bar that fills left-to-right
 * - Exit animation: reverse slide after delay
 * - Layered card shadows for depth
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

export const NotificationToast: React.FC<{
  title?: string;
  description?: string;
  timestamp?: string;
  avatarGradient?: string;
  accentColor?: string;
  backgroundColor?: string;
  exitAfterFrame?: number;
}> = ({
  title = 'Payment received',
  description = 'You received $2,400.00 from Sarah Chen',
  timestamp = '2 minutes ago',
  avatarGradient = 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
  accentColor = '#22C55E',
  backgroundColor = '#09090B',
  exitAfterFrame = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Card entrance: slide from right ---
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
  const enterX = interpolate(enterSpring, [0, 1], [400, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Card exit: slide out to right ---
  const exitSpring = spring({
    frame: frame - exitAfterFrame,
    fps,
    config: { damping: 22, stiffness: 150, mass: 0.6 },
  });
  const exitX = interpolate(exitSpring, [0, 1], [0, 420], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(exitSpring, [0, 0.8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardX = enterX + exitX;

  // --- Content stagger ---
  const titleDelay = 8;
  const titleOpacity = spring({
    frame: frame - titleDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const descDelay = 16;
  const descOpacity = spring({
    frame: frame - descDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const timeDelay = 24;
  const timeOpacity = spring({
    frame: frame - timeDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // --- Progress bar fills over time ---
  const progressStart = 15;
  const progressEnd = exitAfterFrame - 10;
  const progressWidth = interpolate(
    frame,
    [progressStart, progressEnd],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Avatar scale entrance ---
  const avatarScale = spring({
    frame: frame - 4,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.4 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        padding: 40,
      }}
    >
      {/* Card */}
      <div
        style={{
          transform: `translateX(${cardX}px)`,
          opacity: exitOpacity,
          width: 380,
          marginTop: 20,
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: `
              0 1px 3px rgba(0, 0, 0, 0.12),
              0 4px 12px rgba(0, 0, 0, 0.08),
              0 16px 40px rgba(0, 0, 0, 0.16)
            `,
          }}
        >
          {/* Card content */}
          <div
            style={{
              padding: '20px 20px 16px 20px',
              display: 'flex',
              gap: 14,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 20,
                background: avatarGradient,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                transform: `scale(${avatarScale})`,
                boxShadow: `0 2px 8px ${accentColor}30`,
              }}
            >
              {/* Checkmark icon */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M6 10L9 13L14 7"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title */}
              <div
                style={{
                  opacity: titleOpacity,
                  transform: `translateY(${(1 - titleOpacity) * 6}px)`,
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#0F172A',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  letterSpacing: '-0.01em',
                  marginBottom: 4,
                }}
              >
                {title}
              </div>

              {/* Description */}
              <div
                style={{
                  opacity: descOpacity,
                  transform: `translateY(${(1 - descOpacity) * 6}px)`,
                  fontSize: 13,
                  fontWeight: 400,
                  color: '#64748B',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  lineHeight: 1.4,
                  marginBottom: 6,
                }}
              >
                {description}
              </div>

              {/* Timestamp */}
              <div
                style={{
                  opacity: timeOpacity,
                  fontSize: 12,
                  fontWeight: 400,
                  color: '#94A3B8',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                {timestamp}
              </div>
            </div>
          </div>

          {/* Progress bar at bottom */}
          <div
            style={{
              height: 3,
              width: '100%',
              backgroundColor: '#F1F5F9',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressWidth}%`,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}CC)`,
                borderRadius: '0 2px 2px 0',
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
