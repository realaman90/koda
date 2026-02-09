import React from 'react';
import { Composition } from 'remotion';
import './index.css';
import './utils/fonts';
import { Video } from './Video';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={Video}
        durationInFrames={300}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
