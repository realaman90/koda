import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const MainSequence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sample animation - will be replaced by generated code
  const scale = spring({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
      mass: 0.5,
    },
  });

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          fontSize: 80,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 'bold',
          color: '#3B82F6',
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        Koda Animation
      </div>
    </AbsoluteFill>
  );
};
