/**
 * Standalone Remotion Player
 *
 * This component renders the animation using @remotion/player
 * without the full Remotion Studio UI. It's designed to be
 * embedded in an iframe for preview purposes.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { Video } from './Video';

// Default composition settings (can be overridden via URL params)
const DEFAULT_FPS = 60;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_DURATION_FRAMES = 300;

export const RemotionPlayer: React.FC = () => {
  const playerRef = React.useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Read config from URL params (allows dynamic configuration)
  const params = new URLSearchParams(window.location.search);
  const fps = parseInt(params.get('fps') || String(DEFAULT_FPS), 10);
  const width = parseInt(params.get('width') || String(DEFAULT_WIDTH), 10);
  const height = parseInt(params.get('height') || String(DEFAULT_HEIGHT), 10);
  const durationInFrames = parseInt(params.get('duration') || String(DEFAULT_DURATION_FRAMES), 10);
  const autoPlay = params.get('autoplay') === 'true';
  const loop = params.get('loop') !== 'false'; // Default to true

  useEffect(() => {
    if (autoPlay && playerRef.current) {
      playerRef.current.play();
    }
  }, [autoPlay]);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleFrameUpdate = useCallback((frame: number) => setCurrentFrame(frame), []);

  const togglePlayPause = useCallback(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  }, [isPlaying]);

  const restart = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.seekTo(0);
      playerRef.current.play();
    }
  }, []);

  // Format time display
  const formatTime = (frames: number) => {
    const seconds = frames / fps;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* Player area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          minHeight: 0,
        }}
      >
        <Player
          ref={playerRef}
          component={Video}
          compositionWidth={width}
          compositionHeight={height}
          durationInFrames={durationInFrames}
          fps={fps}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          loop={loop}
          autoPlay={autoPlay}
          clickToPlay={true}
          doubleClickToFullscreen={true}
          spaceKeyToPlayOrPause={true}
          moveToBeginningWhenEnded={true}
        />
      </div>

      {/* Controls - compact for iframe embedding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#111',
          borderTop: '1px solid #222',
          flexWrap: 'nowrap',
          minHeight: '44px',
        }}
      >
        {/* Play/Pause button */}
        <button
          onClick={togglePlayPause}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            outline: 'none',
            backgroundColor: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Restart button */}
        <button
          onClick={restart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            outline: 'none',
            backgroundColor: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          ↺
        </button>

        {/* Time display */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#888',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatTime(currentFrame)} / {formatTime(durationInFrames)}
        </div>

        {/* Frame counter */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#555',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          F{currentFrame}/{durationInFrames}
        </div>
      </div>
    </div>
  );
};

export default RemotionPlayer;
