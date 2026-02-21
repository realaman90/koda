'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useCanvasStore } from '@/stores/canvas-store';
import type { MusicGeneratorNode as MusicGeneratorNodeType, MusicDuration } from '@/lib/types';
import {
  Music,
  Play,
  Pause,
  Trash2,
  Download,
  Loader2,
  Type,
  RefreshCw,
  Music2,
  Settings,
} from 'lucide-react';

const DURATION_OPTIONS: MusicDuration[] = [5, 15, 30, 60, 120, 180, 240];

function MusicGeneratorNodeComponent({ id, data, selected }: NodeProps<MusicGeneratorNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Music Generator');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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

  const handleDurationChange = useCallback(
    (value: string) => {
      updateNodeData(id, { duration: parseInt(value) as MusicDuration });
    },
    [id, updateNodeData]
  );

  const handleInstrumentalToggle = useCallback(() => {
    updateNodeData(id, { instrumental: !data.instrumental });
  }, [id, data.instrumental, updateNodeData]);

  const handleGuidanceScaleChange = useCallback(
    (value: number[]) => {
      updateNodeData(id, { guidanceScale: value[0] });
    },
    [id, updateNodeData]
  );

  const handleGenerate = useCallback(async () => {
    const connectedInputs = getConnectedInputs(id);

    let finalPrompt = data.prompt || '';
    if (connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (data.prompt ? `\n${data.prompt}` : '');
    }

    if (!finalPrompt) {
      toast.error('Please enter a prompt or connect a text node');
      return;
    }

    updateNodeData(id, { isGenerating: true, error: undefined });

    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          duration: data.duration,
          instrumental: data.instrumental,
          guidanceScale: data.guidanceScale,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Music generation failed');
      }

      const result = await response.json();

      updateNodeData(id, {
        outputUrl: result.audioUrl,
        isGenerating: false,
      });

      toast.success('Music generated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Music generation failed';
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [id, data.prompt, data.duration, data.instrumental, data.guidanceScale, updateNodeData, getConnectedInputs]);

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
      a.download = `music-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Music downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download music');
    }
  }, [data.outputUrl]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  const connectedInputs = getConnectedInputs(id);
  const hasValidInput = !!(data.prompt || connectedInputs.textContent);

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur rounded-lg px-2 py-1.5 border shadow-xl z-10 node-toolbar-floating">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleGenerate}
            disabled={!hasValidInput || data.isGenerating}
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
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-music)' }}>
        <Music className="h-4 w-4" />
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
                setNodeName(data.name || 'Music Generator');
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
            {data.name || 'Music Generator'}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[320px] rounded-2xl overflow-hidden
          transition-[box-shadow,ring-color] duration-150
          ${data.isGenerating
            ? 'ring-[2.5px] generating-border-subtle animate-subtle-pulse'
            : selected
              ? 'ring-[2.5px] generating-border-subtle'
              : 'ring-1 ring-border hover:ring-muted-foreground/30'
          }
        `}
        style={{ backgroundColor: 'var(--node-card-bg)' }}
      >
        {/* Content Area */}
        <div className="relative">
          {/* Loading State */}
          {data.isGenerating ? (
            <div className="p-4 min-h-[160px] flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-border border-t-muted-foreground animate-spin" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-foreground text-sm font-medium">Generating music...</p>
                <p className="text-muted-foreground text-xs mt-1">This may take a minute</p>
              </div>
            </div>
          ) : data.outputUrl ? (
            /* Audio Player */
            <div className="p-4 space-y-3">
              <audio ref={audioRef} src={data.outputUrl} className="hidden" />
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePlayPause}
                  className="h-10 w-10 bg-primary hover:bg-primary/80 text-white rounded-full"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Music2 className="h-4 w-4 text-primary/80" />
                    <span className="text-sm text-foreground font-medium">Generated Music</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.duration}s</p>
                </div>
              </div>
              {/* Show prompt below player */}
              <p className="text-xs text-muted-foreground line-clamp-2">{data.prompt}</p>
            </div>
          ) : (
            /* Prompt Input */
            <div className="p-4 min-h-[140px]">
              <textarea
                value={data.prompt}
                onChange={handlePromptChange}
                placeholder="Describe the music you want to generate..."
                className="w-full h-[100px] bg-transparent border-none text-sm resize-none focus:outline-none node-input"
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
              <label className="text-xs text-muted-foreground">Guidance Scale: {data.guidanceScale}</label>
              <Slider
                value={[data.guidanceScale]}
                onValueChange={handleGuidanceScaleChange}
                min={1}
                max={15}
                step={0.5}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Bottom Toolbar */}
        <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5 node-bottom-toolbar">
          {/* Duration */}
          <Select value={String(data.duration)} onValueChange={handleDurationChange}>
            <SelectTrigger className="h-7 w-auto bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted">
              <SelectValue>{data.duration}s</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {DURATION_OPTIONS.map((dur) => (
                <SelectItem key={dur} value={String(dur)} className="text-xs">{dur}s</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Instrumental Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleInstrumentalToggle}
            className={`h-7 px-2 text-xs ${
              data.instrumental
                ? 'text-primary/80 bg-primary/20 hover:bg-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {data.instrumental ? 'Instrumental' : 'With Vocals'}
          </Button>

          {/* Settings Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`h-7 w-7 shrink-0 ${
              showSettings
                ? 'text-primary/80 bg-primary/20 hover:bg-primary/30'
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
            disabled={!hasValidInput || data.isGenerating}
            size="icon-sm"
            className="h-8 w-8 min-w-8 bg-primary hover:bg-primary/80 text-white rounded-full disabled:opacity-40 shrink-0"
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

      {/* Input Handle - Text */}
      <div className="absolute -left-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="text"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-yellow-400 !border-zinc-900 hover:!border-zinc-700"
          />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Text Prompt
        </span>
      </div>

      {/* Output Handle - Audio */}
      <div className="absolute -right-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-primary/80 !border-zinc-900 hover:!border-zinc-700"
          />
          <Music className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated audio
        </span>
      </div>
    </div>
  );
}

export const MusicGeneratorNode = memo(MusicGeneratorNodeComponent);
