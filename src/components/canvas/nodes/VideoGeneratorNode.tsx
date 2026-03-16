'use client';

import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { MentionEditor, type MentionItem } from '@/components/ui/mention-editor';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CompareResultsSection } from '@/components/canvas/CompareResultsSection';
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
import {
  DEFAULT_HEYGEN_AVATAR4_VOICE,
  HEYGEN_AVATAR4_VOICES,
  VIDEO_MODEL_CAPABILITIES,
  ENABLED_VIDEO_MODELS,
  normalizeVideoModelOptions,
  resolveDeprecatedVideoModel,
  type VideoModelType,
  type VideoAspectRatio,
  type VideoDuration,
  type VideoResolution,
} from '@/lib/types';
import { useSettingsStore } from '@/stores/settings-store';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import { startVideoCompare } from '@/lib/compare/controller';
import { promoteVideoCompareResult } from '@/lib/compare/run';
import { buildInitialCompareSelection, pruneCompareSelection } from '@/lib/compare/utils';
import { buildVideoGenerationRequest, buildVideoPrompt, getCompatibleVideoCompareModels, validateVideoGenerationInputForModel } from '@/lib/generation/client';
import { useBufferedNodeField } from '@/components/canvas/nodes/useBufferedNodeField';
import { useNodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';
import { CanvasNodeShell } from '@/components/canvas/nodes/chrome/CanvasNodeShell';
import { NodeFloatingToolbar } from '@/components/canvas/nodes/chrome/NodeFloatingToolbar';
import { NodeFooterRail } from '@/components/canvas/nodes/chrome/NodeFooterRail';
import { NodeMediaBadge } from '@/components/canvas/nodes/chrome/NodeMediaBadge';
import { NodeStagePrompt } from '@/components/canvas/nodes/chrome/NodeStagePrompt';
import { useNodeChromeState } from '@/components/canvas/nodes/chrome/useNodeChromeState';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';
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
  ChevronRight,
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
  const addToHistory = useSettingsStore((state) => state.addToHistory);
  const updateHistoryItem = useSettingsStore((state) => state.updateHistoryItem);
  const enabledVideoModels = useSettingsStore((s) => s.defaultSettings.enabledVideoModels) || [...ENABLED_VIDEO_MODELS];
  const visibleVideoModels: VideoModelType[] = ['auto' as VideoModelType, ...ENABLED_VIDEO_MODELS.filter((m) => enabledVideoModels.includes(m))];
  const updateNodeInternals = useUpdateNodeInternals();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Video Generator');
  const [isImproving, setIsImproving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const { displayMode, focusedWithin, focusProps } = useNodeDisplayMode(selected);
  const {
    draft: promptDraft,
    handleChange: handlePromptInputChange,
    handleBlur: handlePromptBlur,
    commit: commitPrompt,
    updateDraft: updatePromptDraft,
  } = useBufferedNodeField({
    nodeId: id,
    value: data.prompt || '',
    field: 'prompt',
    preview: 'skip',
  });

  const originalPromptRef = useRef<string>('');
  const [isHovered, setIsHovered] = useState(false);
  const [isCompareTrayOpen, setIsCompareTrayOpen] = useState(!data.outputUrl);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedModel = resolveDeprecatedVideoModel(data.model);
  const connectedInputs = getConnectedInputs(id);
  const compatibleCompareModels = getCompatibleVideoCompareModels(enabledVideoModels, data, connectedInputs);

  // Check if this node has any connections
  const isConnected = edges.some(edge => edge.source === id || edge.target === id);

  // Get model capabilities
  const modelCapabilities = VIDEO_MODEL_CAPABILITIES[resolvedModel];
  const { inputMode, supportsVideoRef, supportsAudioRef, supportsCharacterRef, maxCharacters } = modelCapabilities;
  const imageRefHandleCount = Math.min(
    14,
    Math.max(0, modelCapabilities.maxReferences ?? (inputMode === 'multi-reference' ? 3 : 0))
  );
  const characterRefCount = supportsCharacterRef ? (maxCharacters || 2) : 0;
  const hasAdvancedHandles = imageRefHandleCount > 0 || !!supportsVideoRef || !!supportsAudioRef || characterRefCount > 0;

  // Build mention items from connected handles (for Tiptap @ autocomplete)
  const mentionItems = useMemo((): MentionItem[] => {
    if (!hasAdvancedHandles) return [];
    const connectedHandles = edges
      .filter(e => e.target === id)
      .map(e => e.targetHandle)
      .filter(Boolean);
    const items: MentionItem[] = [];
    for (let i = 1; i <= imageRefHandleCount; i++) {
      if (connectedHandles.includes(`ref${i}`)) {
        items.push({ id: `image${i}`, label: `image${i}`, type: 'image' });
      }
    }
    if (supportsVideoRef && connectedHandles.includes('video')) {
      items.push({ id: 'video1', label: 'video1', type: 'video' });
    }
    if (supportsAudioRef && connectedHandles.includes('audio')) {
      items.push({ id: 'audio1', label: 'audio1', type: 'audio' });
    }
    for (let i = 1; i <= characterRefCount; i++) {
      if (connectedHandles.includes(`char${i}`)) {
        const charName = data.characterNames?.[`char${i}`] || `character${i}`;
        items.push({ id: `char${i}`, label: charName, type: 'video' });
      }
    }
    return items;
  }, [hasAdvancedHandles, imageRefHandleCount, supportsVideoRef, supportsAudioRef, characterRefCount, data.characterNames, edges, id]);

  const isHeygenAvatarModel = resolvedModel === 'heygen-avatar4-i2v';
  const selectedHeygenVoice = data.heygenVoice || DEFAULT_HEYGEN_AVATAR4_VOICE;
  const heygenVoiceOptions = useMemo(
    () =>
      HEYGEN_AVATAR4_VOICES.map((voice) => ({
        value: voice,
        label: voice,
      })),
    []
  );

  // Update node internals when input mode changes (handles change)
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputMode, supportsVideoRef, supportsAudioRef, imageRefHandleCount, characterRefCount, updateNodeInternals]);

  useEffect(() => {
    if (resolvedModel === data.model) return;
    const normalizedOptions = normalizeVideoModelOptions(resolvedModel, {
      aspectRatio: data.aspectRatio,
      duration: data.duration,
      resolution: data.resolution,
    });
    updateNodeData(id, {
      model: resolvedModel,
      ...normalizedOptions,
    });
  }, [id, data.model, data.aspectRatio, data.duration, data.resolution, resolvedModel, updateNodeData]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!data.compareEnabled) return;

    const { models, removed } = pruneCompareSelection(data.compareModels, compatibleCompareModels);
    if (removed.length === 0) return;

    updateNodeData(id, {
      compareModels: models,
      compareEstimateCredits: undefined,
    }, true);
    toast.info(`Removed incompatible compare models: ${removed.map((model) => VIDEO_MODEL_CAPABILITIES[model].label).join(', ')}`);
  }, [id, data.compareEnabled, data.compareModels, compatibleCompareModels, updateNodeData]);

  useEffect(() => {
    if ((data.compareResults?.length || 0) > 0 && !data.outputUrl) {
      setIsCompareTrayOpen(true);
    }
  }, [data.compareResults, data.outputUrl]);

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
          const finalPrompt = buildVideoPrompt(data, getConnectedInputs(id));
          updateNodeData(id, {
            outputUrl: result.videoUrl,
            outputVideoId: undefined,
            isGenerating: false,
            progress: 100,
            xskillTaskId: undefined,
            xskillTaskModel: undefined,
            xskillStatus: undefined,
            xskillStartedAt: undefined,
          });
          addToHistory({
            type: 'video',
            mode: 'single',
            prompt: finalPrompt || data.prompt || '(no prompt)',
            model: resolvedModel,
            status: 'completed',
            result: { urls: result.videoUrl ? [result.videoUrl] : [], duration: data.duration },
            settings: {
              aspectRatio: data.aspectRatio,
              duration: data.duration,
              resolution: data.resolution,
              generateAudio: data.generateAudio,
            },
          });
          toast.success('Video generated successfully');
        } else if (result.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          const finalPrompt = buildVideoPrompt(data, getConnectedInputs(id));
          updateNodeData(id, {
            error: result.error || 'Video generation failed',
            isGenerating: false,
            progress: 0,
            xskillTaskId: undefined,
            xskillTaskModel: undefined,
            xskillStatus: undefined,
            xskillStartedAt: undefined,
          });
          addToHistory({
            type: 'video',
            mode: 'single',
            prompt: finalPrompt || data.prompt || '(no prompt)',
            model: resolvedModel,
            status: 'failed',
            error: result.error || 'Video generation failed',
            settings: {
              aspectRatio: data.aspectRatio,
              duration: data.duration,
              resolution: data.resolution,
              generateAudio: data.generateAudio,
            },
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
  }, [id, data, resolvedModel, updateNodeData, getConnectedInputs, addToHistory]);

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

  const handlePromptAction = useCallback(
    async (action: 'improve' | 'translate') => {
      const currentPrompt = promptDraft.trim();
      if (!currentPrompt) return;

      const setLoading = action === 'improve' ? setIsImproving : setIsTranslating;
      originalPromptRef.current = currentPrompt;
      setLoading(true);
      updatePromptDraft('');

      try {
        const res = await fetch('/api/plugins/video/prompt-tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: currentPrompt, action }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'text-delta') {
                accumulated += event.text;
                updatePromptDraft(accumulated);
              } else if (event.type === 'error') {
                throw new Error(event.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } catch (err) {
        updatePromptDraft(originalPromptRef.current);
        toast.error(`Failed to ${action} prompt: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    },
    [promptDraft, updatePromptDraft],
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

      if (newModel === 'heygen-avatar4-i2v' && !data.heygenVoice) {
        updates.heygenVoice = DEFAULT_HEYGEN_AVATAR4_VOICE;
      }

      updateNodeData(id, updates);
    },
    [id, data.duration, data.aspectRatio, data.resolution, data.heygenVoice, updateNodeData]
  );

  const handleHeygenVoiceChange = useCallback(
    (value: string) => {
      updateNodeData(id, { heygenVoice: value });
    },
    [id, updateNodeData]
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
      updateNodeData(id, { resolution: value as VideoResolution });
    },
    [id, updateNodeData]
  );

  const handleAudioToggle = useCallback(() => {
    updateNodeData(id, { generateAudio: !data.generateAudio });
  }, [id, data.generateAudio, updateNodeData]);

  const openSettingsFromElement = useCallback((element: HTMLElement) => {
    const rect = element.closest('.react-flow__node')?.getBoundingClientRect();
    if (rect) {
      openVideoSettingsPanel(id, { x: rect.right + 10, y: rect.top });
    }
  }, [id, openVideoSettingsPanel]);

  const handleOpenSettings = useCallback((e: React.MouseEvent) => {
    openSettingsFromElement(e.currentTarget as HTMLElement);
  }, [openSettingsFromElement]);

  const handleGenerate = useCallback(async () => {
    const validationError = validateVideoGenerationInputForModel(data, connectedInputs, resolvedModel);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    await commitPrompt(promptDraft, true);
    const finalData = { ...data, prompt: promptDraft };
    const finalPrompt = buildVideoPrompt(finalData, connectedInputs);
    const requestBody = buildVideoGenerationRequest(data, connectedInputs, resolvedModel);
    updateNodeData(id, { isGenerating: true, error: undefined, progress: 0, outputVideoId: undefined });

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
        // xskill async path — store taskId and start client-side polling
        updateNodeData(id, {
          xskillTaskId: result.taskId,
          xskillTaskModel: result.model,
          xskillStatus: 'pending',
          xskillStartedAt: Date.now(),
          outputVideoId: undefined,
        });
        pollXskillTask(result.taskId, result.model);
        return;
      }

      updateNodeData(id, {
        outputUrl: result.videoUrl,
        outputVideoId: result.videoId,
        thumbnailUrl: result.thumbnailUrl,
        isGenerating: false,
        progress: 100,
      });

      toast.success('Video generated successfully');
      addToHistory({
        type: 'video',
        mode: 'single',
        prompt: finalPrompt || data.prompt || '(no prompt)',
        model: resolvedModel,
        status: 'completed',
        result: { urls: result.videoUrl ? [result.videoUrl] : [], duration: data.duration },
        settings: {
          aspectRatio: data.aspectRatio,
          duration: data.duration,
          resolution: data.resolution,
          generateAudio: data.generateAudio,
        },
      });
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Video generation failed');
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
        progress: 0,
      });
      toast.error(`Generation failed: ${errorMessage}`);
      addToHistory({
        type: 'video',
        mode: 'single',
        prompt: finalPrompt || data.prompt || '(no prompt)',
        model: resolvedModel,
        status: 'failed',
        error: errorMessage,
        settings: {
          aspectRatio: data.aspectRatio,
          duration: data.duration,
          resolution: data.resolution,
          generateAudio: data.generateAudio,
        },
      });
    }
  }, [
    id,
    data,
    resolvedModel,
    connectedInputs,
    updateNodeData,
    pollXskillTask,
    addToHistory,
  ]);

  const handleCompareAction = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();

    const selectedModels = (data.compareModels || []).filter((model) => compatibleCompareModels.includes(model));
    if (!data.compareEnabled || selectedModels.length < 2) {
      const nextSelection = selectedModels.length > 0
        ? selectedModels
        : buildInitialCompareSelection(resolvedModel, compatibleCompareModels);
      updateNodeData(id, {
        compareEnabled: true,
        compareModels: nextSelection,
        compareEstimateCredits: undefined,
      }, true);
      openSettingsFromElement(event.currentTarget as HTMLElement);
      toast.info('Select at least 2 compare models to run a compare.');
      return;
    }

    try {
      const result = await startVideoCompare({
        nodeId: id,
        data,
        connectedInputs,
        updateNodeData,
        history: {
          addToHistory,
          updateHistoryItem,
        },
      });

      if (!result.cancelled) {
        toast.success('Compare run completed');
      }
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Compare failed');
      updateNodeData(id, { error: errorMessage, compareRunStatus: 'failed' }, true);
      toast.error(`Compare failed: ${errorMessage}`);
    }
  }, [id, data, connectedInputs, compatibleCompareModels, resolvedModel, updateNodeData, openSettingsFromElement, addToHistory, updateHistoryItem]);

  const handleClearCompare = useCallback(() => {
    updateNodeData(id, {
      compareRunStatus: 'idle',
      compareEstimateCredits: undefined,
      compareResults: undefined,
      promotedCompareResultId: undefined,
      compareHistoryId: undefined,
      error: undefined,
    }, true);
  }, [id, updateNodeData]);

  const handlePromoteCompare = useCallback((result: NonNullable<typeof data.compareResults>[number]) => {
    promoteVideoCompareResult(id, result, updateNodeData, {
      historyId: data.compareHistoryId,
      updateHistoryItem,
    });
    toast.success(`Promoted ${VIDEO_MODEL_CAPABILITIES[result.model].label}`);
  }, [id, data.compareHistoryId, updateNodeData, updateHistoryItem]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
    toast.success('Node deleted');
  }, [id, deleteNode]);

  const handleDownload = useCallback(async () => {
    if (!data.outputUrl) return;

    try {
      const filename = `video-${Date.now()}.mp4`;
      const proxyUrl = `/api/download?url=${encodeURIComponent(data.outputUrl)}&filename=${encodeURIComponent(filename)}`;
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Video downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download video');
    }
  }, [data.outputUrl]);

  
  const liveData = useMemo(() => ({ ...data, prompt: promptDraft }), [data, promptDraft]);
  const chromeState = useNodeChromeState({
    isHovered,
    focusedWithin,
    isPromptFocused,
    selected,
    displayMode,
    hasOutput: !!data.outputUrl,
    expanded: isPromptExpanded,
  });
  const showHandles = chromeState.showHandles || isConnected;

  const hasValidInput = validateVideoGenerationInputForModel(data, connectedInputs, resolvedModel) === null;
  const hasCompareResults = (data.compareResults?.length || 0) > 0;
  const showCompareAsPrimary = !data.outputUrl && hasCompareResults;

  const advancedHandleSpecs = useMemo(() => {
    const specs: Array<{
      id: string;
      label: string;
      icon: 'image' | 'video' | 'audio';
      badge: string;
    }> = [];

    for (let i = 1; i <= imageRefHandleCount; i++) {
      specs.push({
        id: `ref${i}`,
        label: `@image${i}`,
        icon: 'image',
        badge: String(i),
      });
    }

    if (supportsVideoRef) {
      specs.push({
        id: 'video',
        label: '@video1',
        icon: 'video',
        badge: '1',
      });
    }

    if (supportsAudioRef) {
      specs.push({
        id: 'audio',
        label: '@audio1',
        icon: 'audio',
        badge: '1',
      });
    }

    for (let i = 1; i <= characterRefCount; i++) {
      const charName = data.characterNames?.[`char${i}`] || `character${i}`;
      specs.push({
        id: `char${i}`,
        label: `Character: ${charName}`,
        icon: 'video',
        badge: `C${i}`,
      });
    }

    return specs;
  }, [imageRefHandleCount, supportsVideoRef, supportsAudioRef, characterRefCount, data.characterNames]);

  const promptPlaceholder = data.outputUrl 
    ? 'Add a follow-up prompt...' 
    : 'Describe the video you want to generate...';

  const showTopToolbar = chromeState.showTopToolbar && (!isReadOnly || !!data.outputUrl);
  const showFooterRail = chromeState.showFooterRail && (!isReadOnly || !!data.outputUrl);
  const showOutputOverlay = !data.outputUrl || chromeState.showPromptTeaser || chromeState.showPromptEditor || showFooterRail;

  const topToolbar = showTopToolbar ? (
    <NodeFloatingToolbar>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleGenerate}
        disabled={!hasValidInput || data.isGenerating}
        title={data.outputUrl ? 'Regenerate video' : 'Generate video'}
      >
        {data.outputUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      {!isReadOnly ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCompareAction}
          disabled={!hasValidInput || data.compareRunStatus === 'running'}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title="Compare models"
        >
          <Images className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {data.outputUrl ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownload}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
            onClick={handleDelete}
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
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
          <SearchableSelect
            value={resolvedModel}
            onValueChange={handleModelChange}
            options={visibleVideoModels.map((key) => ({
              value: key,
              label: VIDEO_MODEL_CAPABILITIES[key].label,
              description: VIDEO_MODEL_CAPABILITIES[key].description,
              group: VIDEO_MODEL_CAPABILITIES[key].group,
            }))}
            placeholder="Select model"
            searchPlaceholder="Search models..."
            triggerClassName="max-w-[132px] nodrag nopan"
          />
          {isHeygenAvatarModel ? (
            <SearchableSelect
              value={selectedHeygenVoice}
              onValueChange={handleHeygenVoiceChange}
              options={heygenVoiceOptions}
              placeholder="Voice"
              searchPlaceholder="Search voices..."
              triggerClassName="max-w-[150px] nodrag nopan"
            />
          ) : null}

          <Select value={liveData.aspectRatio} onValueChange={handleAspectRatioChange}>
            <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-muted-foreground" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelCapabilities.aspectRatios.map((ratio) => (
                <SelectItem key={ratio} value={ratio} className="text-xs">
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(liveData.duration)} onValueChange={handleDurationChange}>
            <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
              <SelectValue>{liveData.duration}s</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelCapabilities.durations.map((dur) => (
                <SelectItem key={dur} value={String(dur)} className="text-xs">
                  {dur}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {modelCapabilities.resolutions ? (
            <Select value={liveData.resolution || '720p'} onValueChange={handleResolutionChange}>
              <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
                <SelectValue>{liveData.resolution || '720p'}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modelCapabilities.resolutions.map((res) => (
                  <SelectItem key={res} value={res} className="text-xs">
                    {res}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {modelCapabilities.supportsAudio ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleAudioToggle}
              className={`h-8 w-auto rounded-xl nodrag nopan px-2 text-[11px] flex items-center gap-1.5 ${
                liveData.generateAudio !== false
                  ? 'bg-muted text-foreground hover:bg-muted/80 border border-muted'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <div
                className={`w-[26px] h-[14px] rounded-full flex items-center p-[2px] cursor-pointer transition-colors opacity-90 ${liveData.generateAudio !== false ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-muted-foreground/40 dark:bg-zinc-700/60'}`}
              >
                <div
                  className={`w-[10px] h-[10px] rounded-full bg-background dark:bg-white transition-all shadow-sm ${liveData.generateAudio !== false ? 'translate-x-[12px]' : 'translate-x-[0px]'}`}
                />
              </div>
              <span className="leading-none pt-[1px]">Sound Effects</span>
            </Button>
          ) : null}

          {characterRefCount > 0 && Array.from({ length: characterRefCount }, (_, i) => {
            const handleId = `char${i + 1}`;
            const isConnected = edges.some(e => e.target === id && e.targetHandle === handleId);
            if (!isConnected) return null;
            return (
              <input
                key={handleId}
                className="h-8 w-24 rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={`Char ${i + 1} name`}
                defaultValue={data.characterNames?.[handleId] || ''}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  updateNodeData(id, {
                    characterNames: { ...data.characterNames, [handleId]: val || `character${i + 1}` },
                  });
                }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Character name — use this name in your prompt"
              />
            );
          })}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleOpenSettings}
            className="h-8 w-8 rounded-xl nodrag nopan text-muted-foreground hover:bg-muted/70 hover:text-foreground ml-1"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          <div className="min-w-0 flex-1" />

          <Button
            onClick={handleGenerate}
            disabled={!hasValidInput || data.isGenerating}
            size="icon-sm"
            className="h-10 w-10 min-w-10 rounded-full nodrag nopan bg-primary text-primary-foreground hover:bg-primary/90 ml-auto"
          >
            {data.outputUrl ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
          </Button>
        </>
      ) : null}
    </NodeFooterRail>
  ) : null;

  const promptOverlay = displayMode === 'summary' || (data.outputUrl && !showOutputOverlay) ? null : (
    <NodeStagePrompt
      teaser={chromeState.showPromptTeaser ? (
        data.outputUrl ? (
          <div className="flex flex-col gap-2">
            <p className={`max-w-[78%] text-base leading-7 line-clamp-3 ${promptDraft ? 'text-foreground/82' : 'text-muted-foreground/85'}`}>
              {promptDraft || promptPlaceholder}
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 items-center">
            <p className={`block w-full node-prompt-teaser-clamp text-[15px] leading-6 ${promptDraft ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
              {promptDraft || promptPlaceholder}
            </p>
          </div>
        )
      ) : null}
      expanded={chromeState.showPromptEditor}
      teaserClassName={data.outputUrl ? 'pb-1' : ''}
      editorClassName="pb-1"
      onExpand={
        isReadOnly
          ? undefined
          : () => {
              setIsPromptExpanded(true);
              if (!hasAdvancedHandles) {
                requestAnimationFrame(() => promptTextareaRef.current?.focus());
              }
            }
      }
    >
      <div
        className="flex flex-col gap-3 nodrag nopan"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {hasAdvancedHandles ? (
          <div className="bg-transparent text-[14px]">
            <MentionEditor
              content={promptDraft}
              onChange={updatePromptDraft}
              items={mentionItems}
              placeholder={isReadOnly ? '' : promptPlaceholder}
              disabled={isReadOnly || isImproving || isTranslating}
            />
          </div>
        ) : (
          <textarea
            ref={promptTextareaRef}
            value={promptDraft}
            onChange={handlePromptInputChange}
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
            disabled={isReadOnly || isImproving || isTranslating}
            className={`node-stage-input nodrag nopan nowheel select-text w-full resize-none border-0 bg-transparent px-0 py-0 focus:outline-none ${data.outputUrl ? 'min-h-[96px] text-base leading-7' : 'min-h-[72px] text-[15px] leading-6'} ${isReadOnly ? 'cursor-default' : ''}`}
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
        )}
      </div>
    </NodeStagePrompt>
  );

  const badges = (
    <>
      {data.outputUrl && chromeState.showTopBadges ? (
        <NodeMediaBadge>{data.duration}s</NodeMediaBadge>
      ) : null}
    </>
  );

  const secondaryContent = (
    <>
      {data.error ? <p className="px-1 text-xs text-red-400">{data.error}</p> : null}
      {hasCompareResults && chromeState.showSecondaryContent ? (
        <CompareResultsSection
          type="video"
          results={data.compareResults || []}
          runStatus={data.compareRunStatus}
          promotedCompareResultId={data.promotedCompareResultId}
          getModelLabel={(model) => VIDEO_MODEL_CAPABILITIES[model].label}
          onPromote={handlePromoteCompare}
          onClear={handleClearCompare}
          collapsible
          defaultOpen={isCompareTrayOpen}
        />
      ) : null}
    </>
  );

  return (
    <div className="relative">
      <CanvasNodeShell
        title={isEditingName && !isReadOnly ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(event) => setNodeName(event.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleNameSubmit();
              if (event.key === 'Escape') {
                setNodeName(data.name || 'Video Generator');
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
            {data.name || 'Video Generator'}
          </span>
        )}
        icon={
          <div className="relative h-4 w-4">
            <Video className="h-4 w-4" />
          </div>
        }
        selected={selected}
        hovered={isHovered}
        displayMode={displayMode}
        hasOutput={!!data.outputUrl}
        interactiveMode="visual"
        stageMinHeight={data.outputUrl ? undefined : 360}
        topToolbar={topToolbar}
        footerRail={footerRail}
        promptOverlay={promptOverlay}
        shellMode="visual-stage"
        badges={badges}
        secondaryContent={secondaryContent}
        titleClassName="text-[var(--node-title-video)]"
        cardClassName={data.isGenerating ? 'animate-subtle-pulse generating-border-subtle' : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        focusProps={focusProps}
      >
        {data.isGenerating ? (
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 px-6 pb-[120px] text-center">
            {promptDraft ? (
              <p className="max-w-[90%] text-xs text-muted-foreground line-clamp-2">{promptDraft}</p>
            ) : null}
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
                {data.xskillTaskId
                  ? data.xskillStatus === 'processing' ? 'Rendering video...' : 'Queued...'
                  : 'Generating video...'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.xskillTaskId ? <ElapsedTimer startedAt={data.xskillStartedAt ?? Date.now()} /> : 'This may take a moment'}
              </p>
              {!data.xskillTaskId && data.progress !== undefined && data.progress > 0 && (
                <div className="w-full max-w-[200px] h-1.5 bg-muted rounded-full overflow-hidden mt-2 mx-auto">
                  <div
                    className="h-full bg-muted-foreground transition-all duration-300"
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : data.outputUrl ? (
          <div className={`relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-[inherit] transition-[padding] duration-200 group/video ${showOutputOverlay ? 'pb-[120px]' : 'pb-0'}`}>
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDownload}
                className="absolute top-3 left-3 h-8 w-8 rounded-lg opacity-0 group-hover/video:opacity-100 transition-all duration-200 translate-y-1 group-hover/video:translate-y-0 border border-border/70 bg-white/85 text-foreground/80 hover:bg-white hover:text-foreground backdrop-blur-sm dark:border-white/10 dark:bg-black/50 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-black/70"
              >
                <Download className="h-4 w-4" />
              </Button>
          </div>
        ) : (
          <div className="min-h-[360px] flex-1" />
        )}
      </CanvasNodeShell>

      {/* Input Handles - Left side */}
      {/* Text Input - always shown except for first-last-frame which is image-only */}
      {inputMode !== 'first-last-frame' && (
        <div
          className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
          style={{ top: getPromptHeavyInputHandleTop(0) }}
        >
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
      )}

      {/* Single Image Reference - for single-image mode without multi-ref */}
      {inputMode === 'single-image' && !hasAdvancedHandles && (
        <div
          className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
          style={{ top: getPromptHeavyInputHandleTop(1) }}
        >
          <div className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id="reference"
              className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
            />
            <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
          </div>
          <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
            Reference Image
          </span>
        </div>
      )}

      {/* Advanced reference handles (image/video/audio) */}
      {advancedHandleSpecs.length > 0 && (
        <>
          {advancedHandleSpecs.map((spec, idx) => {
            return (
            <div
              key={spec.id}
              className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
              style={{ top: getPromptHeavyInputHandleTop(idx + 1) }}
            >
              <div className="relative">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={spec.id}
                  className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
                />
                {spec.icon === 'image' && (
                  <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
                )}
                {spec.icon === 'video' && (
                  <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
                )}
                {spec.icon === 'audio' && (
                  <Music className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
                )}
                {spec.badge && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 text-[9px] text-zinc-400 font-bold rounded-full flex items-center justify-center border border-zinc-500/60">{spec.badge}</span>}
              </div>
              <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
                {spec.label}
              </span>
            </div>
          );
          })}
        </>
      )}

      {/* First/Last Frame - for first-last-frame mode */}
      {inputMode === 'first-last-frame' && (
        <>
          <div
            className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: getPromptHeavyInputHandleTop(0) }}
          >
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="firstFrame"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
              />
              <ArrowRightFromLine className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              First Frame
            </span>
          </div>
          <div
            className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: getPromptHeavyInputHandleTop(1) }}
          >
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="lastFrame"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
              />
              <ArrowLeftFromLine className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              Last Frame
            </span>
          </div>
          {/* Text handle for prompt */}
          <div
            className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: getPromptHeavyInputHandleTop(2) }}
          >
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
        </>
      )}

      {/* Multi-Reference - for multi-reference mode */}
      {inputMode === 'multi-reference' && !hasAdvancedHandles && (
        <>
          {[1, 2, 3].map((num, idx) => (
            <div
              key={num}
              className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
              style={{ top: getPromptHeavyInputHandleTop(idx + 1) }}
            >
              <div className="relative">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`ref${num}`}
                  className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
                />
                <Images className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
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
        className={`absolute -right-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated video
        </span>
      </div>
    </div>  );
}

export const VideoGeneratorNode = memo(VideoGeneratorNodeComponent);
