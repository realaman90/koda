'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import type { VideoAudioNode as VideoAudioNodeType, VideoAudioModelType } from '@/lib/types';
import { SYNC_LIPSYNC_MODE_LABELS, VIDEO_AUDIO_MODEL_CAPABILITIES } from '@/lib/types';
import {
  Video,
  Play,
  Trash2,
  Download,
  Type,
  RefreshCw,
  Settings,
  Music2,
  Film,
} from 'lucide-react';
import { useBufferedNodeField } from './useBufferedNodeField';
import { useNodeDisplayMode } from './useNodeDisplayMode';
import { CanvasNodeShell } from '@/components/canvas/nodes/chrome/CanvasNodeShell';
import { NodeFloatingToolbar } from '@/components/canvas/nodes/chrome/NodeFloatingToolbar';
import { NodeFooterRail } from '@/components/canvas/nodes/chrome/NodeFooterRail';
import { NodeStagePrompt } from '@/components/canvas/nodes/chrome/NodeStagePrompt';
import { useNodeChromeState } from '@/components/canvas/nodes/chrome/useNodeChromeState';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';

function normalizeVideoAudioModel(model: unknown): VideoAudioModelType {
  return model === 'sync-lipsync-v2-pro' ? model : 'mmaudio-v2';
}

function VideoAudioNodeComponent({ id, data, selected }: NodeProps<VideoAudioNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Video Audio');
  const [isHovered, setIsHovered] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [, setIsPromptExpanded] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { displayMode, focusedWithin, focusProps } = useNodeDisplayMode(selected);
  const {
    draft: promptDraft,
    handleChange: handlePromptChange,
    handleBlur: handlePromptBlur,
    commit: commitPrompt,
  } = useBufferedNodeField({
    nodeId: id,
    value: data.prompt || '',
    field: 'prompt',
    preview: 'skip',
  });
  const {
    commit: commitNegativePrompt,
  } = useBufferedNodeField({
    nodeId: id,
    value: data.negativePrompt || '',
    field: 'negativePrompt',
    preview: 'skip',
  });
  const videoAudioModel = normalizeVideoAudioModel(data.model);
  const videoAudioCapabilities = VIDEO_AUDIO_MODEL_CAPABILITIES[videoAudioModel];
  const promptPreview = useMemo(
    () =>
      videoAudioCapabilities.supportsPrompt
        ? promptDraft.replace(/\s+/g, ' ').trim()
        : 'Sync connected audio to the connected video',
    [promptDraft, videoAudioCapabilities.supportsPrompt]
  );
  const promptPlaceholder = data.outputUrl
    ? (videoAudioCapabilities.supportsPrompt ? 'Describe new audio...' : 'Keep syncing to a connected audio track...')
    : (videoAudioCapabilities.supportsPrompt ? 'Describe the audio you want (optional)...' : 'Connect a video and audio track to lip-sync');

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

  const openSettingsFromElement = useCallback((element: HTMLElement) => {
    const rect = element.closest('.react-flow__node')?.getBoundingClientRect();
    if (rect) {
      openSettingsPanel(id, { x: rect.right + 10, y: rect.top });
    }
  }, [id, openSettingsPanel]);

  const handleOpenSettings = useCallback((event: React.MouseEvent) => {
    openSettingsFromElement(event.currentTarget as HTMLElement);
  }, [openSettingsFromElement]);

  const handleGenerate = useCallback(async () => {
    await Promise.all([
      commitPrompt(promptDraft, true),
      commitNegativePrompt(data.negativePrompt || '', true),
    ]);
    const connectedInputs = getConnectedInputs(id);

    if (!connectedInputs.videoUrl) {
      toast.error('Please connect a video input');
      return;
    }
    if (videoAudioCapabilities.requiresAudioInput && !connectedInputs.audioUrl) {
      toast.error('Please connect an audio input');
      return;
    }

    let finalPrompt = promptDraft || '';
    if (videoAudioCapabilities.supportsPrompt && connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (promptDraft ? `\n${promptDraft}` : '');
    }

    updateNodeData(id, { isGenerating: true, error: undefined });

    try {
      const response = await fetch('/api/generate-video-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: videoAudioModel,
          prompt: finalPrompt,
          videoUrl: connectedInputs.videoUrl,
          audioUrl: connectedInputs.audioUrl,
          duration: data.duration,
          cfgStrength: data.cfgStrength,
          negativePrompt: data.negativePrompt,
          syncMode: data.syncMode,
        }),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Video audio generation failed');
        throw new Error(message);
      }

      const result = await response.json();

      updateNodeData(id, {
        outputUrl: result.videoUrl,
        isGenerating: false,
      });

      toast.success(
        videoAudioModel === 'sync-lipsync-v2-pro'
          ? 'Lip-synced video generated successfully'
          : 'Video with audio generated successfully'
      );
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Video audio generation failed');
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [
    commitNegativePrompt,
    commitPrompt,
    data.cfgStrength,
    data.duration,
    data.negativePrompt,
    data.syncMode,
    getConnectedInputs,
    id,
    promptDraft,
    updateNodeData,
    videoAudioCapabilities.requiresAudioInput,
    videoAudioCapabilities.supportsPrompt,
    videoAudioModel,
  ]);

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
  const hasAudioInput = !!connectedInputs.audioUrl;
  const isConnected = hasVideoInput || !!connectedInputs.textContent || hasAudioInput;
  const chromeState = useNodeChromeState({
    isHovered,
    focusedWithin,
    isPromptFocused,
    selected,
    displayMode,
    hasOutput: !!data.outputUrl,
  });
  const showHandles = chromeState.showHandles;
  const showTopToolbar = chromeState.showTopToolbar && (!isReadOnly || !!data.outputUrl);
  const showFooterRail = chromeState.showFooterRail && (!isReadOnly || !!data.outputUrl);
  const showTextInputHandle = videoAudioCapabilities.supportsPrompt || !!connectedInputs.textContent;

  // --- Chrome elements ---

  const topToolbar = showTopToolbar ? (
    <NodeFloatingToolbar>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleGenerate}
        disabled={!hasVideoInput || data.isGenerating}
        title={data.outputUrl ? 'Regenerate audio' : 'Generate audio'}
      >
        {data.outputUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      {data.outputUrl ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={handleDownload}
          title="Download video"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {!isReadOnly ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            onClick={handleDelete}
            title="Delete node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleOpenSettings}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : null}
    </NodeFloatingToolbar>
  ) : null;

  const footerRail = showFooterRail ? (
    <NodeFooterRail className="node-footer-rail-plain">
      {!isReadOnly ? (
        <>
          <div className="h-8 flex items-center rounded-xl bg-muted/80 px-2.5 text-xs text-foreground">
            {videoAudioCapabilities.label}
          </div>

          {videoAudioModel === 'mmaudio-v2' ? (
            <>
              <div className="h-8 flex items-center rounded-xl bg-muted/80 px-2.5 text-xs text-foreground">
                {data.duration}s
              </div>

              <div className="h-8 flex items-center rounded-xl bg-muted/80 px-2.5 text-xs text-foreground">
                CFG: {data.cfgStrength}
              </div>
            </>
          ) : (
            <div className="h-8 flex items-center rounded-xl bg-muted/80 px-2.5 text-xs text-foreground">
              {SYNC_LIPSYNC_MODE_LABELS[data.syncMode || 'cut_off']}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleOpenSettings}
            className="h-8 w-8 rounded-xl nodrag nopan text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          <div className="min-w-0 flex-1" />
          <Button
            onClick={handleGenerate}
            disabled={!hasVideoInput || data.isGenerating}
            size="icon-sm"
            className="h-10 w-10 min-w-10 rounded-full nodrag nopan bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {data.outputUrl ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
          </Button>
        </>
      ) : null}
    </NodeFooterRail>
  ) : null;

  const promptOverlay = displayMode === 'summary' ? null : videoAudioCapabilities.supportsPrompt ? (
    <NodeStagePrompt
      teaser={chromeState.showPromptTeaser ? (
        <p className={`node-prompt-teaser-clamp text-[15px] leading-6 ${promptPreview ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
          {promptPreview || promptPlaceholder}
        </p>
      ) : null}
      expanded={chromeState.showPromptEditor}
      onExpand={
        isReadOnly
          ? undefined
          : () => {
              setIsPromptExpanded(true);
              requestAnimationFrame(() => promptTextareaRef.current?.focus());
            }
      }
    >
      <div
        className="flex flex-col gap-3 nodrag nopan"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {/* Connection status badge */}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
          hasVideoInput
            ? 'bg-green-500/10 text-green-500 dark:text-green-400'
            : 'bg-muted/50 text-muted-foreground'
        }`}>
          <Video className="h-3.5 w-3.5" />
          <span>{hasVideoInput ? 'Video connected' : 'Connect a video input'}</span>
        </div>

        {videoAudioCapabilities.requiresAudioInput ? (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
            hasAudioInput
              ? 'bg-green-500/10 text-green-500 dark:text-green-400'
              : 'bg-muted/50 text-muted-foreground'
          }`}>
            <Music2 className="h-3.5 w-3.5" />
            <span>{hasAudioInput ? 'Audio connected' : 'Connect an audio input'}</span>
          </div>
        ) : null}

        <textarea
          ref={promptTextareaRef}
          value={promptDraft}
          onChange={handlePromptChange}
          onFocus={() => {
            setIsPromptExpanded(true);
            setIsPromptFocused(true);
          }}
          onBlur={async () => {
            setIsPromptFocused(false);
            setIsPromptExpanded(false);
            await handlePromptBlur();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setIsPromptFocused(false);
              setIsPromptExpanded(false);
              event.currentTarget.blur();
            }
          }}
          placeholder={isReadOnly ? '' : promptPlaceholder}
          disabled={isReadOnly}
          className={`node-stage-input nodrag nopan nowheel select-text w-full resize-none border-0 bg-transparent px-0 py-0 focus:outline-none min-h-[72px] text-[15px] leading-6 ${isReadOnly ? 'cursor-default' : ''}`}
          style={{
            colorScheme: 'dark',
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            color: 'var(--text-secondary)',
            caretColor: 'var(--text-primary)',
            boxShadow: 'none',
            borderColor: 'transparent',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        />
      </div>
    </NodeStagePrompt>
  ) : (
    <NodeStagePrompt
      teaser={chromeState.showPromptTeaser ? (
        <p className={`node-prompt-teaser-clamp text-[15px] leading-6 ${promptPreview ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
          {promptPreview || promptPlaceholder}
        </p>
      ) : null}
      expanded={chromeState.showPromptEditor}
    >
      <div
        className="flex flex-col gap-3 nodrag nopan"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
          hasVideoInput
            ? 'bg-green-500/10 text-green-500 dark:text-green-400'
            : 'bg-muted/50 text-muted-foreground'
        }`}>
          <Video className="h-3.5 w-3.5" />
          <span>{hasVideoInput ? 'Video connected' : 'Connect a video input'}</span>
        </div>

        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
          hasAudioInput
            ? 'bg-green-500/10 text-green-500 dark:text-green-400'
            : 'bg-muted/50 text-muted-foreground'
        }`}>
          <Music2 className="h-3.5 w-3.5" />
          <span>{hasAudioInput ? 'Audio connected' : 'Connect an audio input'}</span>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          Sync Lipsync uses the incoming audio track directly and ignores prompt guidance. Choose the sync mode in settings, then run the node.
        </div>
      </div>
    </NodeStagePrompt>
  );

  const secondaryContent = data.error ? (
    <p className="px-1 text-xs text-red-400">{data.error}</p>
  ) : null;

  return (
    <div className="relative">
      <CanvasNodeShell
        title={isEditingName && !isReadOnly ? (
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
            className="node-input rounded-none border-0 border-b bg-transparent px-0.5 outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={isReadOnly ? 'cursor-default' : 'cursor-text'}
          >
            {data.name || 'Video Audio'}
          </span>
        )}
        icon={<Film className="h-4 w-4" />}
        selected={selected}
        hovered={isHovered}
        displayMode={displayMode}
        hasOutput={!!data.outputUrl}
        interactiveMode="prompt"
        stageMinHeight={data.outputUrl ? undefined : 280}
        topToolbar={topToolbar}
        footerRail={footerRail}
        promptOverlay={promptOverlay}
        shellMode="visual-stage"
        secondaryContent={secondaryContent}
        titleClassName="text-[var(--node-title-speech)]"
        cardClassName={data.isGenerating ? 'animate-subtle-pulse generating-border-subtle' : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        focusProps={focusProps}
      >
        {data.isGenerating ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-4 px-6 pb-[120px] text-center">
            <div>
              <p
                className="bg-clip-text text-base font-semibold text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, hsl(var(--muted-foreground)/0.45) 0%, hsl(var(--foreground)/0.95) 45%, hsl(var(--muted-foreground)/0.45) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-text 2s ease-in-out infinite',
                }}
              >
                {videoAudioModel === 'sync-lipsync-v2-pro' ? 'Syncing lips to audio...' : 'Adding audio to video...'}
              </p>
              <p className="text-muted-foreground text-xs mt-1">This may take a few minutes</p>
            </div>
          </div>
        ) : data.outputUrl ? (
          <div className="relative min-h-[200px] overflow-hidden rounded-[inherit] pb-[120px]">
            <video
              ref={videoRef}
              src={data.outputUrl}
              controls
              className="w-full h-auto"
              style={{ maxHeight: '300px' }}
            />
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-zinc-300">
              <Music2 className="h-3 w-3 text-primary/80" />
              <span>{videoAudioModel === 'sync-lipsync-v2-pro' ? 'Lip sync ready' : 'Audio synced'}</span>
            </div>
          </div>
        ) : (
          <div className="min-h-[280px] flex-1" />
        )}
      </CanvasNodeShell>

      {/* Input Handles - Left side */}
      <div className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles || isConnected ? 'opacity-100' : 'opacity-0'}`} style={{ top: getPromptHeavyInputHandleTop(0) }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="video"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Video Input
        </span>
      </div>

      <div className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles || hasAudioInput || videoAudioCapabilities.requiresAudioInput ? 'opacity-100' : 'opacity-0'}`} style={{ top: getPromptHeavyInputHandleTop(1) }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="audio"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Music2 className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Audio Input
        </span>
      </div>

      <div className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showTextInputHandle && (showHandles || isConnected) ? 'opacity-100' : 'opacity-0'}`} style={{ top: getPromptHeavyInputHandleTop(2) }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="text"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Prompt Input
        </span>
      </div>

      {/* Output Handle - Right side */}
      <div className={`absolute -right-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`} style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Film className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Video with Audio
        </span>
      </div>
    </div>
  );
}

export const VideoAudioNode = memo(VideoAudioNodeComponent);
