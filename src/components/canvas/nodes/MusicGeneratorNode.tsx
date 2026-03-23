'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useCanvasStore } from '@/stores/canvas-store';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import type { MusicGeneratorNode as MusicGeneratorNodeType, MusicDuration } from '@/lib/types';
import {
  Music,
  Play,
  Pause,
  Trash2,
  Download,
  Type,
  RefreshCw,
  Music2,
  Settings,
} from 'lucide-react';
import { useBufferedNodeField } from './useBufferedNodeField';
import { useNodeDisplayMode } from './useNodeDisplayMode';
import { CanvasNodeShell } from '@/components/canvas/nodes/chrome/CanvasNodeShell';
import { NodeFloatingToolbar } from '@/components/canvas/nodes/chrome/NodeFloatingToolbar';
import { NodeFooterRail } from '@/components/canvas/nodes/chrome/NodeFooterRail';
import { NodeStagePrompt } from '@/components/canvas/nodes/chrome/NodeStagePrompt';
import { useNodeChromeState } from '@/components/canvas/nodes/chrome/useNodeChromeState';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';

const DURATION_OPTIONS: MusicDuration[] = [5, 15, 30, 60, 120, 180, 240];

function MusicGeneratorNodeComponent({ id, data, selected }: NodeProps<MusicGeneratorNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Music Generator');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
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
  const promptPreview = useMemo(
    () => promptDraft.replace(/\s+/g, ' ').trim(),
    [promptDraft]
  );
  const promptPlaceholder = data.outputUrl
    ? 'Describe new music...'
    : 'Describe the music you want to generate...';

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

  const handleDurationChange = useCallback(
    (value: string) => {
      updateNodeData(id, { duration: parseInt(value) as MusicDuration });
    },
    [id, updateNodeData]
  );

  const handleInstrumentalToggle = useCallback(() => {
    updateNodeData(id, { instrumental: !data.instrumental });
  }, [id, data.instrumental, updateNodeData]);

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
    await commitPrompt(promptDraft, true);
    const connectedInputs = getConnectedInputs(id);

    let finalPrompt = promptDraft || '';
    if (connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (promptDraft ? `\n${promptDraft}` : '');
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
        const message = await getApiErrorMessage(response, 'Music generation failed');
        throw new Error(message);
      }

      const result = await response.json();

      updateNodeData(id, {
        outputUrl: result.audioUrl,
        isGenerating: false,
      });

      toast.success('Music generated successfully');
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Music generation failed');
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [commitPrompt, data.duration, data.guidanceScale, data.instrumental, getConnectedInputs, id, promptDraft, updateNodeData]);

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
  const hasValidInput = !!(promptDraft || connectedInputs.textContent);
  const chromeState = useNodeChromeState({
    isHovered,
    focusedWithin,
    isPromptFocused,
    selected,
    displayMode,
    hasOutput: !!data.outputUrl,
  });
  const showHandles = chromeState.showHandles;
  const isConnected = !!(connectedInputs.textContent);
  const showTopToolbar = chromeState.showTopToolbar && (!isReadOnly || !!data.outputUrl);
  const showFooterRail = chromeState.showFooterRail && (!isReadOnly || !!data.outputUrl);

  // --- Chrome elements ---

  const topToolbar = showTopToolbar ? (
    <NodeFloatingToolbar>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleGenerate}
        disabled={!hasValidInput || data.isGenerating}
        title={data.outputUrl ? 'Regenerate music' : 'Generate music'}
      >
        {data.outputUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      {data.outputUrl ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={handleDownload}
          title="Download music"
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
          <Select value={String(data.duration)} onValueChange={handleDurationChange}>
            <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
              <SelectValue>{data.duration}s</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {DURATION_OPTIONS.map((dur) => (
                <SelectItem key={dur} value={String(dur)} className="text-xs">{dur}s</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleInstrumentalToggle}
            className={`h-8 px-2.5 text-xs rounded-xl shrink-0 whitespace-nowrap nodrag nopan ${
              data.instrumental
                ? 'text-primary/80 bg-primary/20 hover:bg-primary/30'
                : 'bg-muted/80 text-muted-foreground hover:bg-muted'
            }`}
          >
            {data.instrumental ? 'Instrumental' : 'Vocals'}
          </Button>

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
            disabled={!hasValidInput || data.isGenerating}
            size="icon-sm"
            className="h-10 w-10 min-w-10 rounded-full nodrag nopan bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {data.outputUrl ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
          </Button>
        </>
      ) : null}
    </NodeFooterRail>
  ) : null;

  const promptOverlay = displayMode === 'summary' ? null : (
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
                setNodeName(data.name || 'Music Generator');
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
            {data.name || 'Music Generator'}
          </span>
        )}
        icon={<Music className="h-4 w-4" />}
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
        titleClassName="text-[var(--node-title-music)]"
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
                Generating music...
              </p>
              <p className="text-muted-foreground text-xs mt-1">This may take a minute</p>
            </div>
          </div>
        ) : data.outputUrl ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-6 pb-[120px]">
            <audio ref={audioRef} src={data.outputUrl} className="hidden" />
            <div className="flex items-center gap-3 w-full p-3 bg-muted/50 rounded-xl">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePlayPause}
                className="h-10 w-10 bg-primary hover:bg-primary/80 text-primary-foreground rounded-full nodrag nopan"
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
          </div>
        ) : (
          <div className="min-h-[280px] flex-1" />
        )}
      </CanvasNodeShell>

      {/* Input Handle - Text */}
      <div className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles || isConnected ? 'opacity-100' : 'opacity-0'}`} style={{ top: getPromptHeavyInputHandleTop(0) }}>
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
          Text Prompt
        </span>
      </div>

      {/* Output Handle - Audio */}
      <div className={`absolute -right-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`} style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Music className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated audio
        </span>
      </div>
    </div>
  );
}

export const MusicGeneratorNode = memo(MusicGeneratorNodeComponent);
