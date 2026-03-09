'use client';

import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react';
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
import { useCanvasStore, createMediaNode } from '@/stores/canvas-store';
import { useSettingsStore } from '@/stores/settings-store';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import type { ImageGeneratorNode as ImageGeneratorNodeType, RecraftStyle, IdeogramStyle } from '@/lib/types';
import { MODEL_CAPABILITIES, ENABLED_IMAGE_MODELS, getApproxDimensions, FLUX_IMAGE_SIZES, RECRAFT_STYLE_LABELS, IDEOGRAM_STYLE_LABELS, getAspectRatioLabel, type FluxImageSize, type NanoBananaResolution, type ImageModelType } from '@/lib/types';
import { startImageCompare } from '@/lib/compare/controller';
import { promoteImageCompareResult } from '@/lib/compare/run';
import { buildInitialCompareSelection, pruneCompareSelection } from '@/lib/compare/utils';
import { buildImageGenerationRequest, buildImagePrompt, getCompatibleImageCompareModels, hasValidImagePromptInput } from '@/lib/generation/client';
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
  ImageIcon,
  Play,
  Trash2,
  Settings,
  Minus,
  Plus,
  RefreshCw,
  Type,
  Download,
  Wand2,
  Sparkle,
  Images,
} from 'lucide-react';

function ImageGeneratorNodeComponent({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<ImageGeneratorNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const addNode = useCanvasStore((state) => state.addNode);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const addToHistory = useSettingsStore((state) => state.addToHistory);
  const updateHistoryItem = useSettingsStore((state) => state.updateHistoryItem);
  const enabledImageModels = useSettingsStore((s) => s.defaultSettings.enabledImageModels) || [...ENABLED_IMAGE_MODELS];
  const visibleImageModels: ImageModelType[] = ['auto' as ImageModelType, ...ENABLED_IMAGE_MODELS.filter((m) => enabledImageModels.includes(m))];
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Image Generator');
  const [isHovered, setIsHovered] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isCompareTrayOpen, setIsCompareTrayOpen] = useState(!data.outputUrl);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rollerWrapRef = useRef<HTMLDivElement>(null);
  const connections = useNodeConnections({ id });
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

  const isConnected = connections.length > 0;

  const modelCapabilities = MODEL_CAPABILITIES[data.model];
  const maxRefs = Math.max(1, modelCapabilities.maxReferences || 1);
  const connectedInputs = getConnectedInputs(id);
  const liveData = useMemo(
    () => ({ ...data, prompt: promptDraft }),
    [data, promptDraft]
  );
  const compatibleCompareModels = getCompatibleImageCompareModels(enabledImageModels, liveData, connectedInputs);
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

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Detect text overflow on prompt teaser to enable edge blur
  useEffect(() => {
    const el = rollerWrapRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    el.classList.toggle('has-overflow', hasOverflow);
  }, [promptDraft, chromeState.showPromptTeaser]);

  useEffect(() => {
    if (!data.compareEnabled) return;

    const { models, removed } = pruneCompareSelection(data.compareModels, compatibleCompareModels);
    if (removed.length === 0) return;

    updateNodeData(id, {
      compareModels: models,
      compareEstimateCredits: undefined,
    }, true);
    toast.info(`Removed incompatible compare models: ${removed.map((model) => MODEL_CAPABILITIES[model].label).join(', ')}`);
  }, [id, data.compareEnabled, data.compareModels, compatibleCompareModels, updateNodeData]);

  useEffect(() => {
    if ((data.compareResults?.length || 0) > 0 && !data.outputUrl) {
      setIsCompareTrayOpen(true);
    }
  }, [data.compareResults, data.outputUrl]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    updateNodeData(id, { name: nodeName });
  }, [id, nodeName, updateNodeData]);

  const handleModelChange = useCallback(
    (value: string) => {
      updateNodeData(id, { model: value });
    },
    [id, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      updateNodeData(id, { aspectRatio: value });
    },
    [id, updateNodeData]
  );

  const handleImageSizeChange = useCallback(
    (value: string) => {
      updateNodeData(id, { imageSize: value as FluxImageSize });
    },
    [id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (value: string) => {
      updateNodeData(id, { resolution: value as NanoBananaResolution });
    },
    [id, updateNodeData]
  );

  const handleStyleChange = useCallback(
    (value: string) => {
      updateNodeData(id, { style: value as RecraftStyle | IdeogramStyle });
    },
    [id, updateNodeData]
  );

  const handleMagicPromptToggle = useCallback(() => {
    updateNodeData(id, { magicPrompt: !data.magicPrompt });
  }, [id, data.magicPrompt, updateNodeData]);

  const handleGenerate = useCallback(async () => {
    await commitPrompt(promptDraft, true);

    const finalPrompt = buildImagePrompt(liveData, connectedInputs);

    if (!finalPrompt) {
      toast.error('Please enter a prompt, connect a text node, or select presets');
      return;
    }
    const requestBody = buildImageGenerationRequest(liveData, connectedInputs);
    const imageCount = requestBody.imageCount;
    updateNodeData(id, { isGenerating: true, error: undefined });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Generation failed');
        throw new Error(message);
      }

      const result = await response.json();
      const imageUrls: string[] = result.imageUrls || [result.imageUrl];

      // Update this node with the first image
      updateNodeData(id, {
        outputUrl: imageUrls[0],
        outputUrls: imageUrls,
        isGenerating: false,
      });

      // Spawn MediaNodes for additional images (if more than 1)
      if (imageUrls.length > 1) {
        imageUrls.slice(1).forEach((url, index) => {
          const mediaNode = createMediaNode({
            x: (positionAbsoluteX || 0) + 400,
            y: (positionAbsoluteY || 0) + index * 200,
          });
          mediaNode.data = { ...mediaNode.data, url, type: 'image' };
          addNode(mediaNode);
        });
      }

      toast.success(`${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''} generated successfully`);

      addToHistory({
        type: 'image',
        mode: 'single',
        prompt: finalPrompt,
        model: liveData.model,
        status: 'completed',
        result: { urls: imageUrls },
        settings: {
          aspectRatio: liveData.aspectRatio,
          imageCount,
          ...(liveData.style && { style: liveData.style }),
          ...(liveData.resolution && { resolution: liveData.resolution }),
          ...(liveData.imageSize && { imageSize: liveData.imageSize }),
        },
      });
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Generation failed');
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);

      addToHistory({
        type: 'image',
        mode: 'single',
        prompt: finalPrompt || promptDraft || '(no prompt)',
        model: liveData.model,
        status: 'failed',
        error: errorMessage,
        settings: { aspectRatio: liveData.aspectRatio, imageCount },
      });
    }
  }, [addNode, addToHistory, commitPrompt, connectedInputs, id, liveData, positionAbsoluteX, positionAbsoluteY, promptDraft, updateNodeData]);

  const openSettingsFromElement = useCallback((element: HTMLElement) => {
    const rect = element.closest('.react-flow__node')?.getBoundingClientRect();
    if (rect) {
      openSettingsPanel(id, { x: rect.right + 10, y: rect.top });
    }
  }, [id, openSettingsPanel]);

  const handleCompareAction = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    const triggerElement = event.currentTarget as HTMLElement;
    await commitPrompt(promptDraft, true);

    const selectedModels = (liveData.compareModels || []).filter((model) => compatibleCompareModels.includes(model));
    if (!liveData.compareEnabled || selectedModels.length < 2) {
      const nextSelection = selectedModels.length > 0
        ? selectedModels
        : buildInitialCompareSelection(liveData.model, compatibleCompareModels);
      updateNodeData(id, {
        compareEnabled: true,
        compareModels: nextSelection,
        compareEstimateCredits: undefined,
      }, true);
      openSettingsFromElement(triggerElement);
      toast.info('Select at least 2 compare models to run a compare.');
      return;
    }

    try {
      const result = await startImageCompare({
        nodeId: id,
        data: liveData,
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
  }, [addToHistory, commitPrompt, compatibleCompareModels, connectedInputs, id, liveData, openSettingsFromElement, promptDraft, updateHistoryItem, updateNodeData]);

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
    promoteImageCompareResult(id, result, updateNodeData, {
      historyId: data.compareHistoryId,
      updateHistoryItem,
    });
    toast.success(`Promoted ${MODEL_CAPABILITIES[result.model].label}`);
  }, [id, data.compareHistoryId, updateNodeData, updateHistoryItem]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
    toast.success('Node deleted');
  }, [id, deleteNode]);

  const handleOpenSettings = useCallback((e: React.MouseEvent) => {
    openSettingsFromElement(e.currentTarget as HTMLElement);
  }, [openSettingsFromElement]);

  const handleDownload = useCallback(async () => {
    if (!data.outputUrl) return;

    try {
      const filename = `image-${Date.now()}.png`;
      const proxyUrl = `/api/download?url=${encodeURIComponent(data.outputUrl)}&filename=${encodeURIComponent(filename)}`;
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Image downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download image');
    }
  }, [data.outputUrl]);

  // Get dimensions for badge
  const dimensions = getApproxDimensions(data.aspectRatio, data.model, data.resolution);

  const hasValidPrompt = hasValidImagePromptInput(liveData, connectedInputs);
  const connectedReferenceCount = (connectedInputs.referenceUrl ? 1 : 0) + (connectedInputs.referenceUrls?.length || 0);
  const hasCompareResults = (data.compareResults?.length || 0) > 0;

  const activePresets = useMemo((): { key: string; label: string; preview: string }[] => {
    const pills: { key: string; label: string; preview: string }[] = [];
    if (data.selectedCharacter?.type === 'preset') {
      pills.push({ key: 'char', label: data.selectedCharacter.label, preview: data.selectedCharacter.preview });
    } else if (data.selectedCharacter?.type === 'custom') {
      pills.push({ key: 'char', label: data.selectedCharacter.label || 'Custom', preview: data.selectedCharacter.imageUrl });
    }
    if (data.selectedStyle) {
      pills.push({ key: 'style', label: data.selectedStyle.label, preview: data.selectedStyle.preview });
    }
    if (data.selectedCameraAngle) {
      pills.push({ key: 'angle', label: data.selectedCameraAngle.label, preview: data.selectedCameraAngle.preview });
    }
    if (data.selectedCameraLens) {
      pills.push({ key: 'lens', label: data.selectedCameraLens.label, preview: data.selectedCameraLens.preview });
    }
    return pills;
  }, [data.selectedCharacter, data.selectedStyle, data.selectedCameraAngle, data.selectedCameraLens]);

  const promptPreview = useMemo(
    () => promptDraft.replace(/\s+/g, ' ').trim(),
    [promptDraft]
  );
  const promptPlaceholder = data.outputUrl
    ? 'Add a follow-up prompt...'
    : 'Describe the image you want to generate...';

  const showTopToolbar = chromeState.showTopToolbar && (!isReadOnly || !!data.outputUrl);
  const showFooterRail = chromeState.showFooterRail && (!isReadOnly || !!data.outputUrl);

  const topToolbar = showTopToolbar ? (
    <NodeFloatingToolbar>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleGenerate}
        disabled={!hasValidPrompt || data.isGenerating}
        title={data.outputUrl ? 'Regenerate image' : 'Generate image'}
      >
        {data.outputUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      {!isReadOnly ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCompareAction}
          disabled={!hasValidPrompt || liveData.compareRunStatus === 'running'}
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
          title="Download image"
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
            value={liveData.model}
            onValueChange={handleModelChange}
            options={visibleImageModels.map((key) => ({
              value: key,
              label: MODEL_CAPABILITIES[key].label,
              description: MODEL_CAPABILITIES[key].description,
              group: MODEL_CAPABILITIES[key].group,
            }))}
            placeholder="Select model"
            searchPlaceholder="Search models..."
            triggerClassName="max-w-[132px] nodrag nopan"
          />
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
                  {getAspectRatioLabel(ratio)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modelCapabilities.resolutions ? (
            <Select value={liveData.resolution || '1K'} onValueChange={handleResolutionChange}>
              <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
                <SelectValue>{liveData.resolution || '1K'}</SelectValue>
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
          {modelCapabilities.imageSizes ? (
            <Select value={liveData.imageSize || 'square_hd'} onValueChange={handleImageSizeChange}>
              <SelectTrigger className="h-8 max-w-[102px] rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted [&>span]:truncate">
                <SelectValue>{FLUX_IMAGE_SIZES[liveData.imageSize || 'square_hd'].label}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modelCapabilities.imageSizes.map((size) => (
                  <SelectItem key={size} value={size} className="text-xs">
                    {FLUX_IMAGE_SIZES[size].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {modelCapabilities.styles ? (
            <Select
              value={liveData.style || (modelCapabilities.styles[0] as string)}
              onValueChange={handleStyleChange}
            >
              <SelectTrigger className="h-8 max-w-[110px] rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted [&>span]:truncate">
                <SelectValue>
                  {liveData.model === 'recraft-v3'
                    ? RECRAFT_STYLE_LABELS[(liveData.style as RecraftStyle) || 'realistic_image']
                    : IDEOGRAM_STYLE_LABELS[(liveData.style as IdeogramStyle) || 'auto']}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modelCapabilities.styles.map((style) => (
                  <SelectItem key={style} value={style} className="text-xs">
                    {liveData.model === 'recraft-v3'
                      ? RECRAFT_STYLE_LABELS[style as RecraftStyle]
                      : IDEOGRAM_STYLE_LABELS[style as IdeogramStyle]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {modelCapabilities.supportsMagicPrompt ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleMagicPromptToggle}
              className={`h-8 w-8 rounded-xl nodrag nopan ${
                liveData.magicPrompt
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
              title={liveData.magicPrompt ? 'Magic Prompt ON' : 'Magic Prompt OFF'}
            >
              <Wand2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <div className="flex h-8 items-center rounded-xl bg-muted/80 px-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-6 p-0 text-muted-foreground nodrag nopan hover:bg-transparent hover:text-foreground"
              onClick={() => updateNodeData(id, { imageCount: Math.max(1, (liveData.imageCount || 1) - 1) })}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center text-xs text-foreground">{liveData.imageCount || 1}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-6 p-0 text-muted-foreground nodrag nopan hover:bg-transparent hover:text-foreground"
              onClick={() => updateNodeData(id, { imageCount: Math.min(modelCapabilities.maxImages, (liveData.imageCount || 1) + 1) })}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

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
            disabled={!hasValidPrompt || data.isGenerating}
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
        data.outputUrl ? (
          <div className="flex flex-col gap-2">
            <p className={`node-prompt-teaser-clamp max-w-[78%] text-base leading-7 ${promptPreview ? 'text-foreground/82' : 'text-muted-foreground/85'}`}>
              {promptPreview || promptPlaceholder}
            </p>
            {activePresets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activePresets.slice(0, 3).map((preset) => (
                  <span
                    key={preset.key}
                    className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/10 px-2 py-0.5 text-[10px] text-muted-foreground/85 backdrop-blur-sm"
                  >
                    <img src={preset.preview} alt="" className="h-4 w-4 rounded-full object-cover" />
                    {preset.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p ref={rollerWrapRef} className={`node-prompt-teaser-clamp text-[15px] leading-6 ${promptPreview ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
            {promptPreview || promptPlaceholder}
          </p>
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
        {connectedReferenceCount > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              {connectedReferenceCount} image{connectedReferenceCount > 1 ? 's' : ''} referenced
            </span>
            {!data.outputUrl && activePresets.length > 0 ? (
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                {activePresets.length} preset{activePresets.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        ) : !data.outputUrl && activePresets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              {activePresets.length} preset{activePresets.length > 1 ? 's' : ''}
            </span>
          </div>
        ) : null}
      </div>
    </NodeStagePrompt>
  );

  const badges = (
    <>
      {data.outputUrl && chromeState.showTopBadges ? (
        <NodeMediaBadge>{dimensions.width} × {dimensions.height}</NodeMediaBadge>
      ) : null}
    </>
  );

  const secondaryContent = (
    <>
      {data.error ? <p className="px-1 text-xs text-red-400">{data.error}</p> : null}
      {hasCompareResults && chromeState.showSecondaryContent ? (
        <CompareResultsSection
          type="image"
          results={data.compareResults || []}
          runStatus={data.compareRunStatus}
          promotedCompareResultId={data.promotedCompareResultId}
          getModelLabel={(model) => MODEL_CAPABILITIES[model].label}
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
                setNodeName(data.name || 'Image Generator');
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
            {data.name || 'Image Generator'}
          </span>
        )}
        icon={
          <div className="relative h-4 w-4">
            <ImageIcon className="h-4 w-4" />
            <Sparkle className="absolute -right-0.5 -top-0.5 h-2 w-2 fill-current" />
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
        titleClassName="text-[var(--node-title-image)]"
        cardClassName={data.isGenerating ? 'animate-subtle-pulse generating-border-subtle' : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        focusProps={focusProps}
      >
        {data.isGenerating ? (
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 px-6 pb-[120px] text-center">
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
                Generating image...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">This may take a moment</p>
            </div>
          </div>
        ) : data.outputUrl ? (
          <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[inherit] pb-[120px]">
            <img src={data.outputUrl} alt="Generated" className="h-auto w-full object-cover" />
          </div>
        ) : (
          <div className="min-h-[360px] flex-1" />
        )}
      </CanvasNodeShell>

      {/* Input Handles - Left side */}
      {/* Text Input */}
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
          Text
        </span>
      </div>
      {/* Reference Image Inputs - only shown for models that support image input */}
      {modelCapabilities.inputType !== 'text-only' && (
        <>
          {/* Single visible reference handle (supports multiple incoming edges). */}
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
              {maxRefs > 1 ? `Reference (${maxRefs} max)` : 'Reference'}
            </span>
          </div>
          {/* Hidden legacy handles to keep older saved edges connected. */}
          {Array.from({ length: 14 }).map((_, index) => (
            <Handle
              key={`legacy-ref-${index + 1}`}
              type="target"
              position={Position.Left}
              id={`ref${index + 1}`}
              className="!absolute !left-0 !w-0 !h-0 !border-0 opacity-0 pointer-events-none"
              style={{ top: getPromptHeavyInputHandleTop(1) }}
            />
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
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated image
        </span>
      </div>
    </div>
  );
}

export const ImageGeneratorNode = memo(ImageGeneratorNodeComponent);
