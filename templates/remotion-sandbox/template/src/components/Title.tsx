import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface TitleProps {
  text: string;
  color?: string;
  fontSize?: number;
}

export const Title: React.FC<TitleProps> = ({
  text,
  color = '#fff',
  fontSize = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
    <div
      style={{
        fontSize,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 'bold',
        color,
        opacity,
        transform: `scale(${scale})`,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
};
