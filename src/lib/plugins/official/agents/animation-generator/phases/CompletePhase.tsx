'use client';

/**
 * CompletePhase Component
 * 
 * Shows final animation output with download and new animation options.
 */

import { useRef, useState } from 'react';
import { Download, Play, Pause, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnimationOutput } from '../types';

interface CompletePhaseProps {
  output: AnimationOutput;
  onNew: () => void;
}

export function CompletePhase({ output, onNew }: CompletePhaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-green-400">
          <Check className="h-4 w-4" />
          <span className="font-medium">Animation Complete</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <span>{formatDuration(output.duration)}</span>
          {output.fileSize && (
            <>
              <span>•</span>
              <span>{formatFileSize(output.fileSize)}</span>
            </>
          )}
        </div>
      </div>

      {/* Video output */}
      <div className="relative rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700">
        <video
          ref={videoRef}
          src={output.videoUrl}
          poster={output.thumbnailUrl}
          className="w-full aspect-video object-cover"
          onEnded={handleVideoEnd}
          loop={false}
          playsInline
        />

        {/* Playback controls overlay */}
        <button
          onClick={togglePlayback}
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
        >
          <div className="h-14 w-14 rounded-full bg-black/50 flex items-center justify-center">
            {isPlaying ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-1" />
            )}
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onNew}
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          New Animation
        </Button>

        <div className="ml-auto">
          <Button
            asChild
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <a href={output.videoUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-1" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
