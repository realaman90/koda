'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useCanvasStore } from '@/stores/canvas-store';
import type { VideoAudioNode as VideoAudioNodeType } from '@/lib/types';
import {
  Video,
  Play,
  Trash2,
  Download,
  Loader2,
  Type,
  RefreshCw,
  Settings,
  Music2,
  Film,
} from 'lucide-react';

function VideoAudioNodeComponent({ id, data, selected }: NodeProps<VideoAudioNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Video Audio');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    updateNodeData(id, { name: nodeName });
  }, [id, nodeName, updateNodeData]);

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { prompt: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleNegativePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { negativePrompt: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (value: number[]) => {
      updateNodeData(id, { duration: value[0] });
    },
    [id, updateNodeData]
  );

  const handleCfgStrengthChange = useCallback(
    (value: number[]) => {
      updateNodeData(id, { cfgStrength: value[0] });
    },
    [id, updateNodeData]
  );

  const handleGenerate = useCallback(async () => {
    const connectedInputs = getConnectedInputs(id);

    // Check for video connection
    if (!connectedInputs.videoUrl) {
      toast.error('Please connect a video input');
      return;
    }

    let finalPrompt = data.prompt || '';
    if (connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (data.prompt ? `\n${data.prompt}` : '');
    }

    updateNodeData(id, { isGenerating: true, error: undefined });

    try {
      const response = await fetch('/api/generate-video-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          videoUrl: connectedInputs.videoUrl,
          duration: data.duration,
          cfgStrength: data.cfgStrength,
          negativePrompt: data.negativePrompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Video audio generation failed');
      }

      const result = await response.json();

      updateNodeData(id, {
        outputUrl: result.videoUrl,
        isGenerating: false,
      });

      toast.success('Video with audio generated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Video audio generation failed';
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [id, data.prompt, data.duration, data.cfgStrength, data.negativePrompt, updateNodeData, getConnectedInputs]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
    toast.success('Node deleted');
  }, [id, deleteNode]);

  const handleDownload = useCallback(async () => {
    if (!data.outputUrl) return;

    try {
      const response = await fetch(data.outputUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-with-audio-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download video');
    }
  }, [data.outputUrl]);

  const connectedInputs = getConnectedInputs(id);
  const hasVideoInput = !!connectedInputs.videoUrl;

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur rounded-lg px-2 py-1.5 border node-toolbar-floating shadow-xl z-10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleGenerate}
            disabled={!hasVideoInput || data.isGenerating}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          {data.outputUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-pink-400">
        <Film className="h-4 w-4" />
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNodeName(data.name || 'Video Audio');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b outline-none px-0.5 min-w-[100px]"
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }}
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingName(true)}
            className="cursor-text transition-colors hover:opacity-80"
          >
            {data.name || 'Video Audio'}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[380px] rounded-2xl overflow-hidden
          transition-[box-shadow,ring-color] duration-150
          ${data.isGenerating
            ? 'ring-[2.5px] ring-pink-500 shadow-lg shadow-pink-500/20 animate-pulse-glow'
            : selected
              ? 'ring-[2.5px] ring-pink-500 shadow-lg shadow-pink-500/10'
              : 'ring-1 ring-border hover:ring-muted-foreground/30'
          }
        `}
        style={{ backgroundColor: 'var(--node-card-bg)' }}
      >
        {/* Content Area */}
        <div className="relative">
          {/* Loading State */}
          {data.isGenerating ? (
            <div className="p-4 min-h-[200px] flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-border border-t-pink-500 animate-spin" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-pink-500 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-foreground text-sm font-medium">Adding audio to video...</p>
                <p className="text-muted-foreground text-xs mt-1">This may take a few minutes</p>
              </div>
            </div>
          ) : data.outputUrl ? (
            /* Video Preview */
            <div className="relative overflow-hidden">
              <video
                ref={videoRef}
                src={data.outputUrl}
                controls
                className="w-full h-auto rounded-t-xl"
                style={{ maxHeight: '250px' }}
              />
              {/* Info overlay */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-zinc-300">
                <Music2 className="h-3 w-3 text-pink-400" />
                <span>Audio synced</span>
              </div>
              {/* Prompt overlay */}
              {data.prompt && (
                <div className="absolute bottom-10 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 pointer-events-none">
                  <p className="text-white text-sm line-clamp-2">{data.prompt}</p>
                </div>
              )}
            </div>
          ) : (
            /* Input State */
            <div className="p-4 min-h-[180px]">
              {/* Connection Status */}
              <div className={`mb-3 p-2 rounded-lg text-xs ${
                hasVideoInput
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-muted/50 text-muted-foreground border border-border'
              }`}>
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5" />
                  <span>{hasVideoInput ? 'Video connected' : 'Connect a video input'}</span>
                </div>
              </div>

              {/* Audio Description */}
              <textarea
                value={data.prompt}
                onChange={handlePromptChange}
                placeholder="Describe the audio you want (optional)..."
                className="w-full h-[80px] bg-transparent border-none text-sm resize-none focus:outline-none node-input"
                style={{ color: 'var(--text-secondary)' }}
              />
            </div>
          )}

          {/* Error Display */}
          {data.error && (
            <p className="text-xs text-red-400 px-4 pb-2">{data.error}</p>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-4 py-3 border-t border-border space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Duration: {data.duration}s</label>
              <Slider
                value={[data.duration]}
                onValueChange={handleDurationChange}
                min={1}
                max={30}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">CFG Strength: {data.cfgStrength.toFixed(1)}</label>
              <Slider
                value={[data.cfgStrength]}
                onValueChange={handleCfgStrengthChange}
                min={1}
                max={10}
                step={0.5}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Negative Prompt (optional)</label>
              <input
                type="text"
                value={data.negativePrompt || ''}
                onChange={handleNegativePromptChange}
                placeholder="Sounds to avoid..."
                className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        )}

        {/* Bottom Toolbar */}
        <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5 node-bottom-toolbar">
          {/* Duration Badge */}
          <div className="px-2 py-1 bg-muted/80 rounded-md text-xs text-muted-foreground">
            {data.duration}s
          </div>

          {/* CFG Badge */}
          <div className="px-2 py-1 bg-muted/80 rounded-md text-xs text-muted-foreground">
            CFG: {data.cfgStrength}
          </div>

          {/* Settings Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`h-7 w-7 shrink-0 ${
              showSettings
                ? 'text-pink-400 bg-pink-500/20 hover:bg-pink-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Generate/Refresh Button */}
          <Button
            onClick={handleGenerate}
            disabled={!hasVideoInput || data.isGenerating}
            size="icon-sm"
            className="h-8 w-8 min-w-8 bg-pink-500 hover:bg-pink-400 text-white rounded-full disabled:opacity-40 shrink-0"
          >
            {data.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : data.outputUrl ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Input Handles - Left side */}
      {/* Video Input - Top Left */}
      <div className="absolute -left-3 group" style={{ top: '35%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="video"
            className={`!relative !transform-none !w-6 !h-6 !border-2 !rounded-md node-handle hover:!border-pink-500 ${
              hasVideoInput ? '!border-green-500' : ''
            }`}
          />
          <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
        <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Video Input
        </span>
      </div>

      {/* Text Input - Bottom Left */}
      <div className="absolute -left-3 group" style={{ top: '65%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="text"
            className="!relative !transform-none !w-6 !h-6 !border-2 !rounded-md node-handle hover:!border-pink-500"
          />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
        <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Audio Description
        </span>
      </div>

      {/* Output Handle - Right side */}
      <div className="absolute -right-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-6 !h-6 !border-2 !rounded-md node-handle hover:!border-green-500"
          />
          <Film className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
        <span className="absolute right-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Video with Audio
        </span>
      </div>
    </div>
  );
}

export const VideoAudioNode = memo(VideoAudioNodeComponent);
