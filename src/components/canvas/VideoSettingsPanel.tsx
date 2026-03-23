'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCanvasStore } from '@/stores/canvas-store';
import type { VideoGeneratorNodeData, VideoModelType, VideoAspectRatio, VideoDuration, VideoResolution } from '@/lib/types';
import {
  DEFAULT_HEYGEN_AVATAR4_VOICE,
  ENABLED_VIDEO_MODELS,
  HEYGEN_AVATAR4_VOICES,
  MAX_COMPARE_MODELS,
  VIDEO_MODEL_CAPABILITIES,
  normalizeVideoModelOptions,
  resolveDeprecatedVideoModel,
  type VideoModelType as VideoModelTypeImport,
} from '@/lib/types';
import { useSettingsStore } from '@/stores/settings-store';
import { fetchVideoCompareEstimate } from '@/lib/compare/run';
import { buildInitialCompareSelection, fillCompareSelection } from '@/lib/compare/utils';
import { startVideoCompare } from '@/lib/compare/controller';
import { buildVideoGenerationRequest, buildVideoPrompt, getCompatibleVideoCompareModels, validateVideoGenerationInputForModel } from '@/lib/generation/client';
import {
  X,
  Play,
  Video,
  Loader2,
  Volume2,
  VolumeX,
  Info,
  Images,
  AlertCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import { useBufferedNodeField } from './nodes/useBufferedNodeField';

const HEYGEN_AVATAR4_VOICE_OPTIONS = HEYGEN_AVATAR4_VOICES.map((voice) => ({
  value: voice,
  label: voice,
}));

export function VideoSettingsPanel() {
  const videoSettingsPanelNodeId = useCanvasStore((state) => state.videoSettingsPanelNodeId);
  const videoSettingsPanelPosition = useCanvasStore((state) => state.videoSettingsPanelPosition);
  const closeVideoSettingsPanel = useCanvasStore((state) => state.closeVideoSettingsPanel);
  const getNode = useCanvasStore((state) => state.getNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const addToHistory = useSettingsStore((state) => state.addToHistory);
  const updateHistoryItem = useSettingsStore((state) => state.updateHistoryItem);
  const enabledVideoModels = useSettingsStore((s) => s.defaultSettings.enabledVideoModels) || [...ENABLED_VIDEO_MODELS];
  const visibleVideoModels: VideoModelTypeImport[] = ['auto' as VideoModelTypeImport, ...ENABLED_VIDEO_MODELS.filter((m) => enabledVideoModels.includes(m))];

  const node = videoSettingsPanelNodeId ? getNode(videoSettingsPanelNodeId) : null;
  const data = node?.type === 'videoGenerator' ? node.data as VideoGeneratorNodeData : undefined;
  const resolvedModel = data ? resolveDeprecatedVideoModel(data.model) : undefined;
  const {
    draft: promptDraft,
    handleChange: handlePromptChange,
    handleBlur: handlePromptBlur,
    commit: commitPrompt,
  } = useBufferedNodeField({
    nodeId: videoSettingsPanelNodeId || '',
    value: data?.prompt || '',
    field: 'prompt',
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const [compareEstimateError, setCompareEstimateError] = useState<string | null>(null);
  const [compareEstimate, setCompareEstimate] = useState<{
    items: Array<{ model: VideoModelType; estimatedCredits: number }>;
    totalCredits: number;
    balance: number | null;
    hasSufficientCredits: boolean | null;
  } | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if ((target as Element).closest?.('[data-radix-popper-content-wrapper], [data-slot="select-content"], [data-searchable-multi-select="true"]')) return;
      closeVideoSettingsPanel();
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

  useEffect(() => {
    if (!videoSettingsPanelNodeId || !data || !resolvedModel || resolvedModel === data.model) return;
    const normalizedOptions = normalizeVideoModelOptions(resolvedModel, {
      aspectRatio: data.aspectRatio,
      duration: data.duration,
      resolution: data.resolution,
    });
    updateNodeData(videoSettingsPanelNodeId, {
      model: resolvedModel,
      ...normalizedOptions,
    });
  }, [
    videoSettingsPanelNodeId,
    data,
    resolvedModel,
    updateNodeData,
  ]);

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

      if (newModel === 'heygen-avatar4-i2v' && !data.heygenVoice) {
        updates.heygenVoice = DEFAULT_HEYGEN_AVATAR4_VOICE;
      }

      updateNodeData(videoSettingsPanelNodeId, updates);
    },
    [videoSettingsPanelNodeId, data, updateNodeData]
  );

  const handleHeygenVoiceChange = useCallback(
    (value: string) => {
      if (videoSettingsPanelNodeId) {
        updateNodeData(videoSettingsPanelNodeId, { heygenVoice: value });
      }
    },
    [videoSettingsPanelNodeId, updateNodeData]
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

  const handleGenerate = useCallback(async () => {
    if (!videoSettingsPanelNodeId || !data) return;
    await commitPrompt(promptDraft, true);

    const connectedInputs = getConnectedInputs(videoSettingsPanelNodeId);
    const localData = { ...data, prompt: promptDraft };
    const resolvedGenerationModel = resolvedModel || localData.model;
    const validationError = validateVideoGenerationInputForModel(localData, connectedInputs, resolvedGenerationModel);
    if (validationError) {
      return;
    }

    const finalPrompt = buildVideoPrompt(localData, connectedInputs);
    const requestBody = buildVideoGenerationRequest(localData, connectedInputs, resolvedGenerationModel);
    updateNodeData(videoSettingsPanelNodeId, { isGenerating: true, error: undefined, progress: 0, outputVideoId: undefined });

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Video generation failed');
        throw new Error(message);
      }

      const result = await response.json();

      if (result.async && result.taskId) {
        updateNodeData(videoSettingsPanelNodeId, {
          xskillTaskId: result.taskId,
          xskillTaskModel: result.model,
          xskillStatus: 'pending',
          xskillStartedAt: Date.now(),
          outputVideoId: undefined,
        });
        return;
      }

      updateNodeData(videoSettingsPanelNodeId, {
        outputUrl: result.videoUrl,
        outputVideoId: result.videoId,
        thumbnailUrl: result.thumbnailUrl,
        isGenerating: false,
        progress: 100,
      });

      addToHistory({
        type: 'video',
        mode: 'single',
        prompt: finalPrompt || localData.prompt || '(no prompt)',
        model: resolvedGenerationModel,
        status: 'completed',
        result: { urls: result.videoUrl ? [result.videoUrl] : [], duration: localData.duration },
        settings: {
          aspectRatio: localData.aspectRatio,
          duration: localData.duration,
          resolution: localData.resolution,
          generateAudio: localData.generateAudio,
        },
      });
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Video generation failed');
      updateNodeData(videoSettingsPanelNodeId, {
        error: errorMessage,
        isGenerating: false,
        progress: 0,
      });

      addToHistory({
        type: 'video',
        mode: 'single',
        prompt: finalPrompt || localData.prompt || '(no prompt)',
        model: resolvedGenerationModel,
        status: 'failed',
        error: errorMessage,
        settings: {
          aspectRatio: localData.aspectRatio,
          duration: localData.duration,
          resolution: localData.resolution,
          generateAudio: localData.generateAudio,
        },
      });
    }
  }, [addToHistory, commitPrompt, data, getConnectedInputs, promptDraft, resolvedModel, updateNodeData, videoSettingsPanelNodeId]);

  const handleCompareToggle = useCallback(() => {
    if (!videoSettingsPanelNodeId || !data) return;

    const compatibleModels = getCompatibleVideoCompareModels(enabledVideoModels, data, getConnectedInputs(videoSettingsPanelNodeId));
    const nextEnabled = !data.compareEnabled;
    updateNodeData(videoSettingsPanelNodeId, {
      compareEnabled: nextEnabled,
      compareModels: nextEnabled
        ? (data.compareModels?.length ? data.compareModels : buildInitialCompareSelection(resolvedModel || data.model, compatibleModels))
        : data.compareModels,
      compareRunStatus: nextEnabled ? (data.compareRunStatus || 'idle') : 'idle',
    }, true);
  }, [videoSettingsPanelNodeId, data, enabledVideoModels, getConnectedInputs, resolvedModel, updateNodeData]);

  const handleCompareModelsChange = useCallback((models: string[]) => {
    if (!videoSettingsPanelNodeId) return;
    setCompareEstimate(null);
    setCompareEstimateError(null);
    updateNodeData(videoSettingsPanelNodeId, {
      compareModels: models as VideoModelType[],
      compareEstimateCredits: undefined,
    }, true);
  }, [videoSettingsPanelNodeId, updateNodeData]);

  const handleCompareFill = useCallback(() => {
    if (!videoSettingsPanelNodeId || !data) return;
    const compatibleModels = getCompatibleVideoCompareModels(enabledVideoModels, data, getConnectedInputs(videoSettingsPanelNodeId));
    handleCompareModelsChange(fillCompareSelection(compatibleModels));
  }, [videoSettingsPanelNodeId, data, enabledVideoModels, getConnectedInputs, handleCompareModelsChange]);

  const handleClearCompare = useCallback(() => {
    if (!videoSettingsPanelNodeId) return;
    setCompareEstimate(null);
    setCompareEstimateError(null);
    updateNodeData(videoSettingsPanelNodeId, {
      compareRunStatus: 'idle',
      compareEstimateCredits: undefined,
      compareResults: undefined,
      promotedCompareResultId: undefined,
      compareHistoryId: undefined,
      error: undefined,
    }, true);
  }, [videoSettingsPanelNodeId, updateNodeData]);

  const handleCompareRun = useCallback(async () => {
    if (!videoSettingsPanelNodeId || !data) return;

    const connectedInputs = getConnectedInputs(videoSettingsPanelNodeId);
    try {
      const result = await startVideoCompare({
        nodeId: videoSettingsPanelNodeId,
        data,
        connectedInputs,
        updateNodeData,
        history: {
          addToHistory,
          updateHistoryItem,
        },
      });
      if (!result.cancelled) {
        setCompareEstimateError(null);
      }
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Compare failed');
      updateNodeData(videoSettingsPanelNodeId, {
        error: errorMessage,
        compareRunStatus: 'failed',
      }, true);
      setCompareEstimateError(errorMessage);
    }
  }, [videoSettingsPanelNodeId, data, getConnectedInputs, updateNodeData, addToHistory, updateHistoryItem]);

  useEffect(() => {
    if (!videoSettingsPanelNodeId || !data?.compareEnabled) {
      setCompareEstimate(null);
      setCompareEstimateError(null);
      return;
    }

    const connectedInputs = getConnectedInputs(videoSettingsPanelNodeId);
    const compatibleModels = getCompatibleVideoCompareModels(enabledVideoModels, data, connectedInputs);
    const selectedModels = (data.compareModels || []).filter((model): model is VideoModelType => compatibleModels.includes(model));
    if (selectedModels.length < 2) {
      setCompareEstimate(null);
      setCompareEstimateError(null);
      if (typeof data.compareEstimateCredits !== 'undefined') {
        updateNodeData(videoSettingsPanelNodeId, { compareEstimateCredits: undefined }, true);
      }
      return;
    }

    let cancelled = false;
    setCompareEstimateError(null);

    fetchVideoCompareEstimate(selectedModels, data.duration, data.generateAudio !== false)
      .then((estimate) => {
        if (cancelled) return;
        setCompareEstimate(estimate);
        if (data.compareEstimateCredits !== estimate.totalCredits) {
          updateNodeData(videoSettingsPanelNodeId, { compareEstimateCredits: estimate.totalCredits }, true);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setCompareEstimate(null);
        setCompareEstimateError(normalizeApiErrorMessage(error, 'Compare estimate failed'));
        if (typeof data.compareEstimateCredits !== 'undefined') {
          updateNodeData(videoSettingsPanelNodeId, { compareEstimateCredits: undefined }, true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    videoSettingsPanelNodeId,
    data?.compareEnabled,
    data?.compareModels,
    data?.compareEstimateCredits,
    data?.duration,
    data?.generateAudio,
    data?.prompt,
    data?.aspectRatio,
    data?.resolution,
    enabledVideoModels,
    getConnectedInputs,
    updateNodeData,
  ]);

  if (!videoSettingsPanelNodeId || !data) return null;

  const connectedInputs = getConnectedInputs(videoSettingsPanelNodeId);
  const modelCapabilities = VIDEO_MODEL_CAPABILITIES[resolvedModel || data.model];
  const { inputMode } = modelCapabilities;
  const isHeygenAvatarModel = (resolvedModel || data.model) === 'heygen-avatar4-i2v';
  const selectedHeygenVoice = data.heygenVoice || DEFAULT_HEYGEN_AVATAR4_VOICE;
  const hasValidInput = validateVideoGenerationInputForModel(data, connectedInputs, resolvedModel || data.model) === null;
  const compatibleCompareModels = getCompatibleVideoCompareModels(enabledVideoModels, data, connectedInputs);
  const compareModelOptions = compatibleCompareModels.map((model) => ({
    value: model,
    label: VIDEO_MODEL_CAPABILITIES[model].label,
    description: VIDEO_MODEL_CAPABILITIES[model].description,
    group: VIDEO_MODEL_CAPABILITIES[model].group,
  }));

  // Calculate position to keep panel on screen
  const getPosition = () => {
    if (!videoSettingsPanelPosition) return { left: 0, top: 0 };

    const panelWidth = 280;
    const panelHeight = 560;
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
      className="fixed w-[280px] max-h-[560px] bg-popover border border-border rounded-lg z-50 flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150"
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
          <Select value={resolvedModel || data.model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full bg-background border-border text-foreground">
              <SelectValue>{modelCapabilities.label}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {visibleVideoModels.map(key => (
                <SelectItem key={key} value={key} className="flex flex-col items-start text-foreground">
                  <span>{VIDEO_MODEL_CAPABILITIES[key].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-500 mt-1.5">{modelCapabilities.description}</p>
        </div>

        {isHeygenAvatarModel && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Voice
            </label>
            <SearchableSelect
              value={selectedHeygenVoice}
              onValueChange={handleHeygenVoiceChange}
              options={HEYGEN_AVATAR4_VOICE_OPTIONS}
              placeholder="Select voice"
              searchPlaceholder="Search voices..."
              triggerClassName="h-9 w-full bg-background border border-border text-foreground text-sm px-3"
            />
          </div>
        )}

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
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Prompt
            </label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border text-popover-foreground max-w-[200px]">
                  <p className="text-xs">
                    <span className="font-medium">Input Mode:</span>{' '}
                    {inputMode === 'text' && 'Text prompt only'}
                    {inputMode === 'single-image' && 'Text + optional reference image'}
                    {inputMode === 'first-last-frame' && (modelCapabilities.lastFrameOptional
                      ? 'Start frame required, end frame optional'
                      : 'First and last frame images required')}
                    {inputMode === 'multi-reference' && `Text + up to ${modelCapabilities.maxReferences ?? 1} reference images`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <textarea
            value={promptDraft}
            onChange={handlePromptChange}
            onBlur={() => {
              void handlePromptBlur();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Describe the video you want to generate..."
            className="w-full min-h-[140px] max-h-[260px] bg-background border border-border rounded-md p-3 text-foreground text-sm placeholder:text-muted-foreground resize-y overflow-y-auto nodrag nopan nowheel select-text focus:outline-none focus:border-input"
          />
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Compare
              </label>
            </div>
            <Button
              variant={data.compareEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={handleCompareToggle}
              className="h-7 text-xs"
            >
              {data.compareEnabled ? 'Enabled' : 'Off'}
            </Button>
          </div>

          {data.compareEnabled && (
            <div className="space-y-3">
              <SearchableMultiSelect
                value={data.compareModels || []}
                onValueChange={handleCompareModelsChange}
                options={compareModelOptions}
                maxSelected={MAX_COMPARE_MODELS}
                placeholder="Select compare models"
                searchPlaceholder="Search compare models..."
                emptyMessage={hasValidInput ? 'No compatible enabled models' : 'Fix inputs to unlock compare models'}
                triggerClassName="h-9 w-full border border-border bg-background px-3 text-sm"
              />

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Compatible enabled models only. Select 2-{MAX_COMPARE_MODELS}.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCompareFill}
                  disabled={compatibleCompareModels.length === 0}
                  className="h-7 px-2 text-[11px]"
                >
                  Fill top {MAX_COMPARE_MODELS}
                </Button>
              </div>

              {compareEstimate?.items?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {compareEstimate.items.map((item) => (
                    <span
                      key={item.model}
                      className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {VIDEO_MODEL_CAPABILITIES[item.model].label}: {item.estimatedCredits} cr
                    </span>
                  ))}
                </div>
              ) : null}

              {(compareEstimateError || data.compareRunStatus === 'failed') && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-2 text-[11px] text-red-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{compareEstimateError || data.error}</span>
                </div>
              )}

              {compareEstimate && (
                <div className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Estimated total</span>
                    <span className="text-sm font-medium text-foreground">{compareEstimate.totalCredits} credits</span>
                  </div>
                  {compareEstimate.balance !== null && (
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Balance</span>
                      <span className="text-xs text-foreground">{compareEstimate.balance} credits</span>
                    </div>
                  )}
                  {compareEstimate.hasSufficientCredits === false && (
                    <p className="mt-2 text-[11px] text-amber-300">
                      Not enough credits for this compare run.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCompareRun}
                  disabled={!hasValidInput || (data.compareModels?.length || 0) < 2 || data.compareRunStatus === 'running'}
                  className="flex-1"
                >
                  {data.compareRunStatus === 'running' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <Images className="h-4 w-4" />
                      Run Compare
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearCompare}
                  disabled={!data.compareResults?.length && !data.compareHistoryId && !data.promotedCompareResultId}
                >
                  Clear Compare
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {data.error && (
          <p className="text-xs text-destructive p-2 bg-destructive/10 rounded-md">{data.error}</p>
        )}
      </div>
    </div>
  );
}
