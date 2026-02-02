'use client';

/**
 * PreviewPhase Component
 * 
 * Shows animation preview with Accept/Regenerate approval gate.
 * Based on Pencil design: Node/AnimationGenerator/Review/Dark
 */

import { useState, useRef } from 'react';
import { Check, RefreshCw, Play, Pause, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnimationPreview } from '../types';

interface PreviewPhaseProps {
  preview: AnimationPreview;
  onAccept: () => void;
  onRegenerate: () => void;
  isLoading?: boolean;
}

export function PreviewPhase({
  preview,
  onAccept,
  onRegenerate,
  isLoading,
}: PreviewPhaseProps) {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="text-lg">🎬</span>
        <span className="font-medium text-zinc-200">Preview Ready</span>
        <span className="ml-auto text-xs">{formatDuration(preview.duration)}</span>
      </div>

      {/* Video preview */}
      <div className="relative rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700">
        {preview.videoUrl ? (
          <video
            ref={videoRef}
            src={preview.videoUrl}
            className="w-full aspect-video object-cover"
            onEnded={handleVideoEnd}
            loop={false}
            playsInline
          />
        ) : (
          // Placeholder for when video isn't ready
          <div className="w-full aspect-video flex items-center justify-center bg-zinc-900">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                <Play className="h-6 w-6 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-500">Preview loading...</p>
            </div>
          </div>
        )}

        {/* Playback controls overlay */}
        {preview.videoUrl && (
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
        )}
      </div>

      {/* Streaming indicator */}
      {preview.streamUrl && (
        <div className="flex items-center gap-2 text-xs text-blue-400">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          Live preview
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onRegenerate}
          disabled={isLoading}
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Regenerate
        </Button>

        <div className="ml-auto flex gap-2">
          {preview.videoUrl && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            >
              <a href={preview.videoUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
            </Button>
          )}
          <Button
            onClick={onAccept}
            disabled={isLoading || !preview.videoUrl}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Finalizing...</span>
              </div>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Accept
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
