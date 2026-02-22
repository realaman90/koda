'use client';

import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { MentionEditor, type MentionItem } from '@/components/ui/mention-editor';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCanvasStore } from '@/stores/canvas-store';
import type { VideoGeneratorNode as VideoGeneratorNodeType } from '@/lib/types';
import { VIDEO_MODEL_CAPABILITIES, ENABLED_VIDEO_MODELS, type VideoModelType, type VideoAspectRatio, type VideoDuration } from '@/lib/types';
import {
  Video,
  Play,
  Trash2,
  Download,
  Loader2,
  Type,
  ImageIcon,
  ArrowRightFromLine,
  ArrowLeftFromLine,
  Images,
  Settings,
  Volume2,
  VolumeX,
  RefreshCw,
  Music,
} from 'lucide-react';

/** Small elapsed-time display that ticks every second */
function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <p className="text-muted-foreground text-xs tabular-nums">
      {mins}:{secs.toString().padStart(2, '0')} elapsed
    </p>
  );
}

function VideoGeneratorNodeComponent({ id, data, selected }: NodeProps<VideoGeneratorNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const openVideoSettingsPanel = useCanvasStore((state) => state.openVideoSettingsPanel);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const edges = useCanvasStore((state) => state.edges);
  const updateNodeInternals = useUpdateNodeInternals();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Video Generator');
  const [isHovered, setIsHovered] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if this node has any connections
  const isConnected = edges.some(edge => edge.source === id || edge.target === id);
  const showHandles = selected || isHovered || isConnected;

  // Get model capabilities
  const modelCapabilities = VIDEO_MODEL_CAPABILITIES[data.model];
  const { inputMode, supportsVideoRef } = modelCapabilities;

  // Build mention items from connected handles (for Tiptap @ autocomplete)
  const mentionItems = useMemo((): MentionItem[] => {
    if (!supportsVideoRef) return [];
    const connectedHandles = edges
      .filter(e => e.target === id)
      .map(e => e.targetHandle)
      .filter(Boolean);
    const items: MentionItem[] = [];
    for (let i = 1; i <= 3; i++) {
      if (connectedHandles.includes(`ref${i}`)) {
        items.push({ id: `image${i}`, label: `image${i}`, type: 'image' });
      }
    }
    if (connectedHandles.includes('video')) {
      items.push({ id: 'video1', label: 'video1', type: 'video' });
    }
    if (connectedHandles.includes('audio')) {
      items.push({ id: 'audio1', label: 'audio1', type: 'audio' });
    }
    return items;
  }, [supportsVideoRef, edges, id]);

  // Update node internals when input mode changes (handles change)
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputMode, supportsVideoRef, updateNodeInternals]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Poll xskill task status
  const pollXskillTask = useCallback((taskId: string, taskModel: string) => {
    // Clear any existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/generate-video/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            model: taskModel,
            prompt: data.prompt || '',
            nodeId: id,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Poll failed');
        }

        const result = await response.json();

        if (result.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          updateNodeData(id, {
            outputUrl: result.videoUrl,
            isGenerating: false,
            progress: 100,
            xskillTaskId: undefined,
            xskillTaskModel: undefined,
            xskillStatus: undefined,
            xskillStartedAt: undefined,
          });
          toast.success('Video generated successfully');
        } else if (result.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          updateNodeData(id, {
            error: result.error || 'Video generation failed',
            isGenerating: false,
            progress: 0,
            xskillTaskId: undefined,
            xskillTaskModel: undefined,
            xskillStatus: undefined,
            xskillStartedAt: undefined,
          });
          toast.error(`Generation failed: ${result.error || 'Unknown error'}`);
        }
        // pending/processing — update status for UI
        if (result.status === 'pending' || result.status === 'processing') {
          updateNodeData(id, { xskillStatus: result.status });
        }
      } catch (error) {
        console.error('[VideoGenerator] Poll error:', error);
        // Don't stop polling on transient network errors
      }
    }, 5000);
  }, [id, data.prompt, updateNodeData]);

  // Resume/start polling whenever an async xskill task is active.
  useEffect(() => {
    if (data.xskillTaskId && data.xskillTaskModel && data.isGenerating) {
      pollXskillTask(data.xskillTaskId, data.xskillTaskModel);
    }
  }, [data.xskillTaskId, data.xskillTaskModel, data.isGenerating, pollXskillTask]);

  // Cleanup polling interval on unmount.
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    updateNodeData(id, { name: nodeName });
  }, [id, nodeName, updateNodeData]);

  const handlePromptChange = useCallback(
    (value: string) => {
      updateNodeData(id, { prompt: value });
    },
    [id, updateNodeData]
  );

  const handleModelChange = useCallback(
    (value: string) => {
      const newModel = value as VideoModelType;
      const newCaps = VIDEO_MODEL_CAPABILITIES[newModel];

      // Check if current duration is supported by new model
      const currentDuration = data.duration;
      const updates: Partial<typeof data> = { model: newModel };

      // If current duration not supported, use model's default
      if (!newCaps.durations.includes(currentDuration)) {
        updates.duration = newCaps.defaultDuration;
      }

      // If current aspect ratio not supported, use first available
      if (!newCaps.aspectRatios.includes(data.aspectRatio)) {
        updates.aspectRatio = newCaps.aspectRatios[0];
      }

      // Set resolution if model supports it and not already set
      if (newCaps.resolutions && !data.resolution) {
        updates.resolution = '720p';
      }

      updateNodeData(id, updates);
    },
    [id, data.duration, data.aspectRatio, data.resolution, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      updateNodeData(id, { aspectRatio: value as VideoAspectRatio });
    },
    [id, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (value: string) => {
      updateNodeData(id, { duration: parseInt(value) as VideoDuration });
    },
    [id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (value: string) => {
      updateNodeData(id, { resolution: value as '540p' | '720p' | '1080p' });
    },
    [id, updateNodeData]
  );

  const handleAudioToggle = useCallback(() => {
    updateNodeData(id, { generateAudio: !data.generateAudio });
  }, [id, data.generateAudio, updateNodeData]);

  const handleOpenSettings = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).closest('.react-flow__node')?.getBoundingClientRect();
    if (rect) {
      openVideoSettingsPanel(id, { x: rect.right + 10, y: rect.top });
    }
  }, [id, openVideoSettingsPanel]);

  const handleGenerate = useCallback(async () => {
    const connectedInputs = getConnectedInputs(id);
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
        toast.error('Connect a start frame image');
        return;
      }
      if (!modelCaps.lastFrameOptional && !connectedInputs.lastFrameUrl) {
        toast.error('Connect both first and last frame images');
        return;
      }
    } else if (modelCaps.inputMode === 'multi-reference') {
      if (!connectedInputs.referenceUrls?.length && !connectedInputs.referenceUrl) {
        toast.error('Connect at least one reference image');
        return;
      }
    } else if (modelCaps.inputMode === 'single-image' && modelCaps.inputType === 'image-only') {
      if (!connectedInputs.referenceUrl) {
        toast.error('This model requires a reference image');
        return;
      }
    }

    if (!finalPrompt && !hasAnyMediaInput) {
      toast.error('Please enter a prompt or connect media references');
      return;
    }

    updateNodeData(id, { isGenerating: true, error: undefined, progress: 0 });

    // Debug: Log what we're sending
    console.log('[VideoGenerator] Sending request:', {
      nodeId: id,
      model: data.model,
      hasReferenceUrl: !!connectedInputs.referenceUrl,
      hasFirstFrameUrl: !!connectedInputs.firstFrameUrl,
      hasLastFrameUrl: !!connectedInputs.lastFrameUrl,
      referenceUrlsCount: connectedInputs.referenceUrls?.length || 0,
      hasVideoUrl: !!connectedInputs.videoUrl,
      hasAudioUrl: !!connectedInputs.audioUrl,
    });

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
        // xskill async path — store taskId and start client-side polling
        updateNodeData(id, {
          xskillTaskId: result.taskId,
          xskillTaskModel: result.model,
          xskillStatus: 'pending',
          xskillStartedAt: Date.now(),
        });
        pollXskillTask(result.taskId, result.model);
        return;
      }

      updateNodeData(id, {
        outputUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        isGenerating: false,
        progress: 100,
      });

      toast.success('Video generated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Video generation failed';
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
        progress: 0,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [id, data.prompt, data.model, data.aspectRatio, data.duration, data.resolution, data.generateAudio, updateNodeData, getConnectedInputs, pollXskillTask]);

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
      a.download = `video-${Date.now()}.mp4`;
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
  const hasAnyMediaInput = !!(
    connectedInputs.referenceUrl ||
    connectedInputs.firstFrameUrl ||
    connectedInputs.lastFrameUrl ||
    connectedInputs.referenceUrls?.length ||
    connectedInputs.videoUrl ||
    connectedInputs.audioUrl
  );

  // Determine if we have valid inputs based on mode
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

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Floating Toolbar - hidden in read-only mode */}
      {selected && !isReadOnly && !data.isGenerating && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg px-2 py-1.5 node-toolbar-floating z-10">
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
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-video)' }}>
        <Video className="h-4 w-4" />
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
                setNodeName(data.name || 'Video Generator');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b outline-none px-0.5 min-w-[100px]"
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }}
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={`transition-colors hover:opacity-80 ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
          >
            {data.name || 'Video Generator'}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[420px] rounded-2xl overflow-hidden
          transition-all duration-150
          ${data.isGenerating ? 'animate-subtle-pulse generating-border-subtle' : ''}
          ${!data.isGenerating ? (selected ? 'node-card-selected' : 'node-card') : ''}
        `}
      >
        {/* Content Area */}
        <div className="relative">
          {/* Loading State */}
          {data.isGenerating ? (
            <div className="p-4 min-h-[200px] flex flex-col items-center justify-center gap-4">
              <div className="text-center">
                <p
                  className="text-base font-semibold bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, hsl(var(--muted-foreground)/0.45) 0%, hsl(var(--foreground)/0.95) 45%, hsl(var(--muted-foreground)/0.45) 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer-text 2s ease-in-out infinite',
                  }}
                >
                  {data.xskillTaskId
                    ? data.xskillStatus === 'processing' ? 'Rendering video...' : 'Queued...'
                    : 'Generating video...'}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {data.xskillTaskId ? 'Typically 2-5 minutes' : 'This may take a few minutes'}
                </p>
              </div>
              {/* Elapsed timer for xskill */}
              {data.xskillStartedAt && <ElapsedTimer startedAt={data.xskillStartedAt} />}
              {/* Progress bar */}
              {!data.xskillTaskId && data.progress !== undefined && data.progress > 0 && (
                <div className="w-full max-w-[200px] h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-muted-foreground transition-all duration-300"
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : data.outputUrl ? (
            /* Video Preview - with hover controls */
            <div className="group/video relative overflow-hidden rounded-2xl">
              <video
                ref={videoRef}
                src={data.outputUrl}
                poster={data.thumbnailUrl}
                className="w-full h-auto cursor-pointer"
                style={{ maxHeight: '300px' }}
                onClick={(e) => {
                  const video = e.currentTarget;
                  if (video.paused) {
                    video.play();
                  } else {
                    video.pause();
                  }
                }}
              />
              {/* Duration badge - visible on hover */}
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded text-xs text-zinc-300 font-medium opacity-0 group-hover/video:opacity-100 transition-opacity duration-200">
                {data.duration}s
              </div>
              {/* Download button - visible on hover */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDownload}
                className="absolute top-3 left-3 h-8 w-8 bg-black/50 backdrop-blur-sm text-zinc-300 hover:text-white hover:bg-black/70 rounded-lg opacity-0 group-hover/video:opacity-100 transition-all duration-200 translate-y-1 group-hover/video:translate-y-0"
              >
                <Download className="h-4 w-4" />
              </Button>
              {/* Gradient overlay for better visibility - visible on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-300 pointer-events-none" />
              {/* Prompt overlay - visible on hover */}
              <div className="absolute bottom-16 left-3 right-3 opacity-0 group-hover/video:opacity-100 transition-all duration-200 translate-y-2 group-hover/video:translate-y-0 pointer-events-none">
                <p className="text-white/80 text-sm font-medium drop-shadow-lg line-clamp-2">
                  {connectedInputs.textContent ? 'Prompt (connected)' : data.prompt ? data.prompt.slice(0, 60) + (data.prompt.length > 60 ? '...' : '') : ''}
                </p>
              </div>
              {/* Floating Toolbar - visible on hover with smooth animation */}
              {!isReadOnly && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 px-2.5 py-2 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 opacity-0 group-hover/video:opacity-100 transition-all duration-300 ease-out translate-y-2 group-hover/video:translate-y-0 shadow-xl">
                  <SearchableSelect
                    value={data.model}
                    onValueChange={handleModelChange}
                    options={Object.entries(VIDEO_MODEL_CAPABILITIES).map(([key, cap]) => ({
                      value: key,
                      label: cap.label,
                      description: cap.description,
                      group: cap.group,
                    }))}
                    placeholder="Select model"
                    searchPlaceholder="Search models..."
                    triggerClassName="max-w-[100px] bg-white/10 hover:bg-white/20 border-0"
                  />
                  <Select value={data.aspectRatio} onValueChange={handleAspectRatioChange}>
                    <SelectTrigger className="h-7 w-auto bg-white/10 hover:bg-white/20 border-0 text-xs text-white gap-1 px-2 rounded-md">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 border border-white/50 rounded-[2px]" />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {modelCapabilities.aspectRatios.map((ratio) => (
                        <SelectItem key={ratio} value={ratio} className="text-xs">{ratio}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(data.duration)} onValueChange={handleDurationChange}>
                    <SelectTrigger className="h-7 w-auto bg-white/10 hover:bg-white/20 border-0 text-xs text-white gap-1 px-2 rounded-md">
                      <SelectValue>{data.duration}s</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {modelCapabilities.durations.map((dur) => (
                        <SelectItem key={dur} value={String(dur)} className="text-xs">{dur}s</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelCapabilities.supportsAudio && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleAudioToggle}
                      className={`h-7 w-7 shrink-0 ${
                        data.generateAudio !== false
                          ? 'text-foreground bg-muted/50 hover:bg-muted/80'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                      title={data.generateAudio !== false ? 'Audio ON' : 'Audio OFF'}
                    >
                      {data.generateAudio !== false ? (
                        <Volume2 className="h-3.5 w-3.5" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleOpenSettings}
                    className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 shrink-0"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1" />
                  <Button
                    onClick={handleGenerate}
                    disabled={!hasValidInput || data.isGenerating}
                    size="icon-sm"
                    className="h-8 w-8 min-w-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-40 shrink-0 transition-all duration-200 hover:scale-105"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Prompt Input - Freepik style with inner content area */
            <div className="p-3">
              <div className="node-content-area p-3 min-h-[160px]">
                {supportsVideoRef ? (
                  <MentionEditor
                    content={data.prompt}
                    onChange={handlePromptChange}
                    items={mentionItems}
                    placeholder="Type @ to reference connected images/videos..."
                    disabled={isReadOnly}
                  />
                ) : (
                  <textarea
                    value={data.prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    placeholder={isReadOnly ? '' : 'Describe the video you want to generate...'}
                    disabled={isReadOnly}
                    className={`w-full h-[130px] bg-transparent border-none text-sm resize-none focus:outline-none ${isReadOnly ? 'cursor-default' : ''}`}
                    style={{ color: 'var(--text-secondary)' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {data.error && (
            <p className="text-xs text-red-400 px-4 pb-2">{data.error}</p>
          )}
        </div>

        {/* Bottom Toolbar - visible on hover or selected, only when no output */}
        {!isReadOnly && !data.outputUrl && !data.isGenerating && (selected || isHovered) && (
        <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5 node-bottom-toolbar">
          {/* Model Selector */}
          <SearchableSelect
            value={data.model}
            onValueChange={handleModelChange}
            options={ENABLED_VIDEO_MODELS.map(key => ({
              value: key,
              label: VIDEO_MODEL_CAPABILITIES[key].label,
              description: VIDEO_MODEL_CAPABILITIES[key].description,
              group: VIDEO_MODEL_CAPABILITIES[key].group,
            }))}
            placeholder="Select model"
            searchPlaceholder="Search models..."
            triggerClassName="max-w-[110px]"
          />

          {/* Aspect Ratio */}
          <Select value={data.aspectRatio} onValueChange={handleAspectRatioChange}>
            <SelectTrigger className="h-7 w-auto bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-muted-foreground rounded-[2px]" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelCapabilities.aspectRatios.map((ratio) => (
                <SelectItem key={ratio} value={ratio} className="text-xs">{ratio}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Duration */}
          <Select value={String(data.duration)} onValueChange={handleDurationChange}>
            <SelectTrigger className="h-7 w-auto bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted">
              <SelectValue>{data.duration}s</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelCapabilities.durations.map((dur) => (
                <SelectItem key={dur} value={String(dur)} className="text-xs">{dur}s</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Resolution - for models that support it */}
          {modelCapabilities.resolutions && (
            <Select value={data.resolution || '720p'} onValueChange={handleResolutionChange}>
              <SelectTrigger className="h-7 w-auto bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted">
                <SelectValue>{data.resolution || '720p'}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modelCapabilities.resolutions.map((res) => (
                  <SelectItem key={res} value={res} className="text-xs">{res}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Audio Toggle - for models that support audio */}
          {modelCapabilities.supportsAudio && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleAudioToggle}
              className={`h-7 w-7 shrink-0 ${
                data.generateAudio !== false
                  ? 'text-foreground bg-muted hover:bg-muted/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title={data.generateAudio !== false ? 'Audio ON' : 'Audio OFF'}
            >
              {data.generateAudio !== false ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleOpenSettings}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 cursor-pointer"
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
            className="h-8 w-8 min-w-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-40 shrink-0"
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
        )}
      </div>

      {/* Input Handles - Left side */}
      {/* Text Input - always shown except for first-last-frame which is image-only */}
      {inputMode !== 'first-last-frame' && (
        <div
          className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
          style={{ top: inputMode === 'text' ? '50%' : supportsVideoRef ? '18%' : '30%', transform: 'translateY(-50%)' }}
        >
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
      )}

      {/* Single Image Reference - for single-image mode without multi-ref */}
      {inputMode === 'single-image' && !supportsVideoRef && (
        <div
          className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
          style={{ top: '60%', transform: 'translateY(-50%)' }}
        >
          <div className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id="reference"
              className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-red-400 !border-zinc-900 hover:!border-zinc-700"
            />
            <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
          </div>
          <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
            Reference Image
          </span>
        </div>
      )}

      {/* Numbered image + video handles for omni-reference models (e.g. Seedance 2.0) */}
      {supportsVideoRef && (
        <>
          {[1, 2, 3].map((num) => (
            <div
              key={`img${num}`}
              className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
              style={{ top: `${34 + (num - 1) * 16}%`, transform: 'translateY(-50%)' }}
            >
              <div className="relative">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`ref${num}`}
                  className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-red-400 !border-zinc-900 hover:!border-zinc-700"
                />
                <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 text-[9px] text-red-300 font-bold rounded-full flex items-center justify-center border border-red-400/60">{num}</span>
              </div>
              <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
                @image{num}
              </span>
            </div>
          ))}
          <div
            className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: '82%', transform: 'translateY(-50%)' }}
          >
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="video"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-blue-400 !border-zinc-900 hover:!border-zinc-700"
              />
              <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 text-[9px] text-blue-300 font-bold rounded-full flex items-center justify-center border border-blue-400/60">1</span>
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              @video1
            </span>
          </div>

          {/* Audio Reference Handle */}
          <div
            className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: '95%', transform: 'translateY(-50%)' }}
          >
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="audio"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-purple-400 !border-zinc-900 hover:!border-zinc-700"
              />
              <Music className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 text-[9px] text-purple-300 font-bold rounded-full flex items-center justify-center border border-purple-400/60">1</span>
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              @audio1
            </span>
          </div>
        </>
      )}

      {/* First/Last Frame - for first-last-frame mode */}
      {inputMode === 'first-last-frame' && (
        <>
          <div
            className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: '35%', transform: 'translateY(-50%)' }}
          >
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="firstFrame"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-emerald-400 !border-zinc-900 hover:!border-zinc-700"
              />
              <ArrowRightFromLine className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              First Frame
            </span>
          </div>
          <div
            className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: '55%', transform: 'translateY(-50%)' }}
          >
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="lastFrame"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-rose-400 !border-zinc-900 hover:!border-zinc-700"
              />
              <ArrowLeftFromLine className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              Last Frame
            </span>
          </div>
          {/* Text handle for prompt */}
          <div
            className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: '75%', transform: 'translateY(-50%)' }}
          >
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
        </>
      )}

      {/* Multi-Reference - for multi-reference mode */}
      {inputMode === 'multi-reference' && (
        <>
          {[1, 2, 3].map((num, idx) => (
            <div
              key={num}
              className={`absolute -left-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
              style={{ top: `${45 + idx * 15}%`, transform: 'translateY(-50%)' }}
            >
              <div className="relative">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`ref${num}`}
                  className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-red-400 !border-zinc-900 hover:!border-zinc-700"
                />
                <Images className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
              </div>
              <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
                Reference {num}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Output Handle - Right side */}
      <div
        className={`absolute -right-3 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-purple-500 !border-zinc-900 hover:!border-zinc-700"
          />
          <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated video
        </span>
      </div>
    </div>
  );
}

export const VideoGeneratorNode = memo(VideoGeneratorNodeComponent);
