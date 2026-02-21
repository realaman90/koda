'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCanvasStore } from '@/stores/canvas-store';
import type { VideoGeneratorNodeData, VideoModelType, VideoAspectRatio, VideoDuration, VideoResolution } from '@/lib/types';
import { VIDEO_MODEL_CAPABILITIES, ENABLED_VIDEO_MODELS } from '@/lib/types';
import {
  X,
  Play,
  Video,
  Loader2,
  Volume2,
  VolumeX,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function VideoSettingsPanel() {
  const videoSettingsPanelNodeId = useCanvasStore((state) => state.videoSettingsPanelNodeId);
  const videoSettingsPanelPosition = useCanvasStore((state) => state.videoSettingsPanelPosition);
  const closeVideoSettingsPanel = useCanvasStore((state) => state.closeVideoSettingsPanel);
  const getNode = useCanvasStore((state) => state.getNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);

  const node = videoSettingsPanelNodeId ? getNode(videoSettingsPanelNodeId) : null;
  const data = node?.data as VideoGeneratorNodeData | undefined;

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeVideoSettingsPanel();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeVideoSettingsPanel();
      }
    };

    if (videoSettingsPanelNodeId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [videoSettingsPanelNodeId, closeVideoSettingsPanel]);

  const handleModelChange = useCallback(
    (value: string) => {
      if (!videoSettingsPanelNodeId || !data) return;

      const newModel = value as VideoModelType;
      const newCaps = VIDEO_MODEL_CAPABILITIES[newModel];
      const updates: Partial<VideoGeneratorNodeData> = { model: newModel };

      // If current duration not supported, use model's default
      if (!newCaps.durations.includes(data.duration)) {
        updates.duration = newCaps.defaultDuration;
      }

      // If current aspect ratio not supported, use first available
      if (!newCaps.aspectRatios.includes(data.aspectRatio)) {
        updates.aspectRatio = newCaps.aspectRatios[0];
      }

      // Set resolution if model supports it
      if (newCaps.resolutions && !data.resolution) {
        updates.resolution = '720p';
      }

      updateNodeData(videoSettingsPanelNodeId, updates);
    },
    [videoSettingsPanelNodeId, data, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      if (videoSettingsPanelNodeId) {
        updateNodeData(videoSettingsPanelNodeId, { aspectRatio: value as VideoAspectRatio });
      }
    },
    [videoSettingsPanelNodeId, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (value: string) => {
      if (videoSettingsPanelNodeId) {
        updateNodeData(videoSettingsPanelNodeId, { duration: parseInt(value) as VideoDuration });
      }
    },
    [videoSettingsPanelNodeId, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (value: string) => {
      if (videoSettingsPanelNodeId) {
        updateNodeData(videoSettingsPanelNodeId, { resolution: value as VideoResolution });
      }
    },
    [videoSettingsPanelNodeId, updateNodeData]
  );

  const handleAudioToggle = useCallback(() => {
    if (videoSettingsPanelNodeId && data) {
      updateNodeData(videoSettingsPanelNodeId, { generateAudio: !data.generateAudio });
    }
  }, [videoSettingsPanelNodeId, data, updateNodeData]);

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (videoSettingsPanelNodeId) {
        updateNodeData(videoSettingsPanelNodeId, { prompt: e.target.value });
      }
    },
    [videoSettingsPanelNodeId, updateNodeData]
  );

  const handleGenerate = useCallback(async () => {
    if (!videoSettingsPanelNodeId || !data) return;

    const connectedInputs = getConnectedInputs(videoSettingsPanelNodeId);
    const modelCaps = VIDEO_MODEL_CAPABILITIES[data.model];
    const hasAnyMediaInput = !!(
      connectedInputs.referenceUrl ||
      connectedInputs.firstFrameUrl ||
      connectedInputs.lastFrameUrl ||
      connectedInputs.referenceUrls?.length ||
      connectedInputs.videoUrl ||
      connectedInputs.audioUrl
    );

    let finalPrompt = data.prompt || '';
    if (connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (data.prompt ? `\n${data.prompt}` : '');
    }

    // Validate based on input mode
    if (modelCaps.inputMode === 'first-last-frame') {
      // First frame always required, last frame depends on lastFrameOptional
      if (!connectedInputs.firstFrameUrl) {
        return;
      }
      if (!modelCaps.lastFrameOptional && !connectedInputs.lastFrameUrl) {
        return;
      }
    } else if (modelCaps.inputMode === 'multi-reference') {
      if (!connectedInputs.referenceUrls?.length && !connectedInputs.referenceUrl) {
        return;
      }
    } else if (modelCaps.inputMode === 'single-image' && modelCaps.inputType === 'image-only') {
      if (!connectedInputs.referenceUrl) {
        return;
      }
    }

    if (!finalPrompt && !hasAnyMediaInput) {
      return;
    }

    updateNodeData(videoSettingsPanelNodeId, { isGenerating: true, error: undefined, progress: 0 });

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: data.model,
          aspectRatio: data.aspectRatio,
          duration: data.duration,
          resolution: data.resolution,
          referenceUrl: connectedInputs.referenceUrl,
          firstFrameUrl: connectedInputs.firstFrameUrl,
          lastFrameUrl: connectedInputs.lastFrameUrl,
          referenceUrls: connectedInputs.referenceUrls,
          videoUrl: connectedInputs.videoUrl,
          audioUrl: connectedInputs.audioUrl,
          generateAudio: data.generateAudio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Video generation failed');
      }

      const result = await response.json();

      if (result.async && result.taskId) {
        updateNodeData(videoSettingsPanelNodeId, {
          xskillTaskId: result.taskId,
          xskillTaskModel: result.model,
          xskillStatus: 'pending',
          xskillStartedAt: Date.now(),
        });
        return;
      }

      updateNodeData(videoSettingsPanelNodeId, {
        outputUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        isGenerating: false,
        progress: 100,
      });
    } catch (error) {
      updateNodeData(videoSettingsPanelNodeId, {
        error: error instanceof Error ? error.message : 'Video generation failed',
        isGenerating: false,
        progress: 0,
      });
    }
  }, [videoSettingsPanelNodeId, data, updateNodeData, getConnectedInputs]);

  if (!videoSettingsPanelNodeId || !data) return null;

  const connectedInputs = getConnectedInputs(videoSettingsPanelNodeId);
  const modelCapabilities = VIDEO_MODEL_CAPABILITIES[data.model];
  const { inputMode } = modelCapabilities;

  // Determine if we have valid inputs
  const hasAnyMediaInput = !!(
    connectedInputs.referenceUrl ||
    connectedInputs.firstFrameUrl ||
    connectedInputs.lastFrameUrl ||
    connectedInputs.referenceUrls?.length ||
    connectedInputs.videoUrl ||
    connectedInputs.audioUrl
  );

  const hasValidInput = (() => {
    const hasPrompt = !!(data.prompt || connectedInputs.textContent);

    switch (inputMode) {
      case 'text':
        return hasPrompt;
      case 'single-image':
        return hasPrompt || hasAnyMediaInput;
      case 'first-last-frame':
        // First frame required, last frame depends on lastFrameOptional
        if (!connectedInputs.firstFrameUrl) return false;
        return modelCapabilities.lastFrameOptional || !!connectedInputs.lastFrameUrl;
      case 'multi-reference':
        return hasPrompt && (!!connectedInputs.referenceUrls?.length || !!connectedInputs.referenceUrl);
      default:
        return hasPrompt;
    }
  })();

  // Calculate position to keep panel on screen
  const getPosition = () => {
    if (!videoSettingsPanelPosition) return { left: 0, top: 0 };

    const panelWidth = 280;
    const panelHeight = 450;
    const padding = 20;

    let left = videoSettingsPanelPosition.x;
    let top = videoSettingsPanelPosition.y;

    // Keep panel on screen horizontally
    if (left + panelWidth > window.innerWidth - padding) {
      left = videoSettingsPanelPosition.x - panelWidth - 360;
    }

    // Keep panel on screen vertically
    if (top + panelHeight > window.innerHeight - padding) {
      top = window.innerHeight - panelHeight - padding;
    }

    return { left: Math.max(padding, left), top: Math.max(padding, top) };
  };

  const position = getPosition();

  return (
    <div
      ref={panelRef}
      className="fixed w-[280px] max-h-[450px] bg-popover border border-border rounded-lg z-50 flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.left, top: position.top }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground font-medium text-sm">
            {data.name || 'Video Generator'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            onClick={handleGenerate}
            disabled={!hasValidInput || data.isGenerating}
            className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-40"
          >
            {data.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closeVideoSettingsPanel}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Model */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Model
          </label>
          <Select value={data.model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full bg-background border-border text-foreground">
              <SelectValue>{modelCapabilities.label}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {ENABLED_VIDEO_MODELS.map(key => (
                <SelectItem key={key} value={key} className="flex flex-col items-start text-foreground">
                  <span>{VIDEO_MODEL_CAPABILITIES[key].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-500 mt-1.5">{modelCapabilities.description}</p>
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Duration
          </label>
          <Select value={String(data.duration)} onValueChange={handleDurationChange}>
            <SelectTrigger className="w-full bg-background border-border text-foreground">
              <SelectValue>{data.duration}s</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelCapabilities.durations.map((dur) => (
                <SelectItem key={dur} value={String(dur)}>
                  {dur} seconds
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modelCapabilities.durations.length === 1 && (
            <p className="text-xs text-zinc-500 mt-1">This model only supports {modelCapabilities.durations[0]}s duration</p>
          )}
        </div>

        {/* Aspect Ratio */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Aspect Ratio
          </label>
          <Select value={data.aspectRatio} onValueChange={handleAspectRatioChange}>
            <SelectTrigger className="w-full bg-background border-border text-foreground">
              <SelectValue>{data.aspectRatio}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelCapabilities.aspectRatios.map((ratio) => (
                <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resolution - for models that support it */}
        {modelCapabilities.resolutions && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Resolution
            </label>
            <Select value={data.resolution || '720p'} onValueChange={handleResolutionChange}>
              <SelectTrigger className="w-full bg-background border-border text-foreground">
                <SelectValue>{data.resolution || '720p'}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modelCapabilities.resolutions.map((res) => (
                  <SelectItem key={res} value={res}>{res}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Audio Toggle - for models that support audio */}
        {modelCapabilities.supportsAudio && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Audio
            </label>
            <Button
              variant="outline"
              onClick={handleAudioToggle}
              className={`w-full justify-start gap-2 ${
                data.generateAudio !== false
                  ? 'bg-accent border-border text-accent-foreground hover:bg-accent/80'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {data.generateAudio !== false ? (
                <>
                  <Volume2 className="h-4 w-4" />
                  Audio Enabled
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" />
                  Audio Disabled
                </>
              )}
            </Button>
          </div>
        )}

        {/* Prompt */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">
              Prompt
            </label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200 max-w-[200px]">
                  <p className="text-xs">
                    <span className="font-medium">Input Mode:</span>{' '}
                    {inputMode === 'text' && 'Text prompt only'}
                    {inputMode === 'single-image' && 'Text + optional reference image'}
                    {inputMode === 'first-last-frame' && (modelCapabilities.lastFrameOptional
                      ? 'Start frame required, end frame optional'
                      : 'First and last frame images required')}
                    {inputMode === 'multi-reference' && `Text + up to ${modelCapabilities.maxReferences || 3} reference images`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <textarea
            value={data.prompt}
            onChange={handlePromptChange}
            placeholder="Describe the video you want to generate..."
            className="w-full h-[100px] bg-background border border-border rounded-md p-3 text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:border-input"
          />
        </div>

        {/* Error */}
        {data.error && (
          <p className="text-xs text-destructive p-2 bg-destructive/10 rounded-md">{data.error}</p>
        )}
      </div>
    </div>
  );
}
