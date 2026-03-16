'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCanvasStore } from '@/stores/canvas-store';
import type {
  ImageGeneratorNodeData,
  ImageReference,
  FluxImageSize,
  NanoBananaResolution,
  RecraftStyle,
  IdeogramStyle,
  CharacterPreset,
  StylePreset,
  CameraAnglePreset,
  CameraLensPreset,
  PresetOption,
  MusicGeneratorNodeData,
  SpeechNodeData,
  VideoAudioNodeData,
  ProductShotNodeData,
  ProductShotBackground,
  ProductShotLighting,
  SpeechModelType,
  TadaLanguage,
  VideoAudioModelType,
  SyncLipsyncMode,
} from '@/lib/types';
import { MAX_COMPARE_MODELS } from '@/lib/types';
import {
  MODEL_CAPABILITIES,
  ENABLED_IMAGE_MODELS,
  FLUX_IMAGE_SIZES,
  NANO_BANANA_RESOLUTIONS,
  RECRAFT_STYLE_LABELS,
  IDEOGRAM_STYLE_LABELS,
  SPEECH_MODEL_CAPABILITIES,
  SPEECH_MODEL_OPTIONS,
  TADA_LANGUAGE_LABELS,
  VIDEO_AUDIO_MODEL_CAPABILITIES,
  VIDEO_AUDIO_MODEL_OPTIONS,
  SYNC_LIPSYNC_MODE_LABELS,
  getApproxDimensions,
  getAspectRatioLabel,
  type ImageModelType,
} from '@/lib/types';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import { useSettingsStore } from '@/stores/settings-store';
import { fetchImageCompareEstimate } from '@/lib/compare/run';
import { buildInitialCompareSelection, fillCompareSelection } from '@/lib/compare/utils';
import { startImageCompare } from '@/lib/compare/controller';
import { buildImageGenerationRequest, buildImagePrompt, getCompatibleImageCompareModels, hasValidImagePromptInput } from '@/lib/generation/client';
import { CHARACTER_PRESETS, STYLE_PRESETS, CAMERA_ANGLE_PRESETS, CAMERA_LENS_PRESETS } from '@/lib/presets';
import { PresetPopover } from './PresetPopover';
import { Slider } from '@/components/ui/slider';
import {
  X,
  Play,
  Minus,
  Plus,
  Sparkles,
  User,
  Upload,
  Image as ImageIcon,
  Loader2,
  Wand2,
  Palette,
  Aperture,
  Camera,
  Images,
  AlertCircle,
  Music,
  Mic,
  Film,
} from 'lucide-react';

export function SettingsPanel() {
  const settingsPanelNodeId = useCanvasStore((state) => state.settingsPanelNodeId);
  const settingsPanelPosition = useCanvasStore((state) => state.settingsPanelPosition);
  const closeSettingsPanel = useCanvasStore((state) => state.closeSettingsPanel);
  const getNode = useCanvasStore((state) => state.getNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const addToHistory = useSettingsStore((state) => state.addToHistory);
  const updateHistoryItem = useSettingsStore((state) => state.updateHistoryItem);
  const enabledImageModels = useSettingsStore((s) => s.defaultSettings.enabledImageModels) || [...ENABLED_IMAGE_MODELS];
  const visibleImageModels: ImageModelType[] = ['auto' as ImageModelType, ...ENABLED_IMAGE_MODELS.filter((m) => enabledImageModels.includes(m))];

  const node = settingsPanelNodeId ? getNode(settingsPanelNodeId) : null;
  const nodeType = node?.type as string | undefined;
  const data = node?.type === 'imageGenerator' ? node.data as ImageGeneratorNodeData : undefined;
  const musicData = node?.type === 'musicGenerator' ? node.data as MusicGeneratorNodeData : undefined;
  const speechData = node?.type === 'speech' ? node.data as SpeechNodeData : undefined;
  const videoAudioData = node?.type === 'videoAudio' ? node.data as VideoAudioNodeData : undefined;
  const productShotData = node?.type === 'productShot' ? node.data as ProductShotNodeData : undefined;
  const anyData = data || musicData || speechData || videoAudioData || productShotData;

  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<'style' | 'character' | 'upload'>('upload');
  const [compareEstimateError, setCompareEstimateError] = useState<string | null>(null);
  const [compareEstimate, setCompareEstimate] = useState<{
    items: Array<{ model: ImageModelType; estimatedCredits: number }>;
    totalCredits: number;
    balance: number | null;
    hasSufficientCredits: boolean | null;
  } | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the panel
      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }
      // Don't close if clicking inside a preset popover modal (portaled to body)
      const presetModal = document.querySelector('[data-preset-modal="true"]');
      if (presetModal && presetModal.contains(target)) {
        return;
      }
      // Don't close if clicking inside a Radix UI Select dropdown (portaled to body)
      // Check both popper mode wrapper and item-aligned mode content (data-slot set in our Select component)
      const radixSelect = (target as Element).closest?.('[data-radix-popper-content-wrapper], [data-slot="select-content"]');
      if (radixSelect || (target as Element).closest?.('[data-searchable-multi-select="true"]')) {
        return;
      }
      closeSettingsPanel();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettingsPanel();
      }
    };

    if (settingsPanelNodeId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [settingsPanelNodeId, closeSettingsPanel]);

  // Generate unique ID for references
  const generateRefId = () => `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const handleReferenceUpload = useCallback(
    (file: File, type: 'style' | 'character' | 'upload') => {
      if (!settingsPanelNodeId || !data) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        const newRef: ImageReference = { id: generateRefId(), url, type };
        updateNodeData(settingsPanelNodeId, {
          references: [...(data.references || []), newRef],
        });
      };
      reader.readAsDataURL(file);
    },
    [settingsPanelNodeId, data, updateNodeData]
  );

  const handleDeleteReference = useCallback(
    (refId: string) => {
      if (!settingsPanelNodeId || !data) return;
      updateNodeData(settingsPanelNodeId, {
        references: (data.references || []).filter((r) => r.id !== refId),
      });
    },
    [settingsPanelNodeId, data, updateNodeData]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleReferenceUpload(file, pendingUploadType);
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleReferenceUpload, pendingUploadType]
  );

  const triggerFileUpload = useCallback((type: 'style' | 'character' | 'upload') => {
    setPendingUploadType(type);
    fileInputRef.current?.click();
  }, []);

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { prompt: e.target.value });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleModelChange = useCallback(
    (value: string) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { model: value });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { aspectRatio: value });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (value: string) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { resolution: value as NanoBananaResolution });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleImageSizeChange = useCallback(
    (value: string) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { imageSize: value as FluxImageSize });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleStyleChange = useCallback(
    (value: string) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { style: value as RecraftStyle | IdeogramStyle });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleMagicPromptToggle = useCallback(() => {
    if (settingsPanelNodeId && data) {
      updateNodeData(settingsPanelNodeId, { magicPrompt: !data.magicPrompt });
    }
  }, [settingsPanelNodeId, data, updateNodeData]);

  const handleCfgScaleChange = useCallback(
    (value: number[]) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { cfgScale: value[0] });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleStepsChange = useCallback(
    (value: number[]) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { steps: value[0] });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleStrengthChange = useCallback(
    (value: number[]) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, { strength: value[0] / 100 });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  // Preset selection handlers
  const handleCharacterSelect = useCallback(
    (preset: PresetOption | null) => {
      if (settingsPanelNodeId) {
        if (preset) {
          updateNodeData(settingsPanelNodeId, {
            selectedCharacter: { ...preset, type: 'preset' } as CharacterPreset,
          });
        } else {
          updateNodeData(settingsPanelNodeId, { selectedCharacter: null });
        }
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleCharacterUpload = useCallback(
    (file: File) => {
      if (!settingsPanelNodeId) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        updateNodeData(settingsPanelNodeId, {
          selectedCharacter: {
            id: `custom_${Date.now()}`,
            type: 'custom',
            imageUrl: url,
          },
        });
      };
      reader.readAsDataURL(file);
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleClearCustomCharacter = useCallback(() => {
    if (settingsPanelNodeId) {
      updateNodeData(settingsPanelNodeId, { selectedCharacter: null });
    }
  }, [settingsPanelNodeId, updateNodeData]);

  const handleStylePresetSelect = useCallback(
    (preset: PresetOption | null) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, {
          selectedStyle: preset as StylePreset | null,
        });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleCameraAngleSelect = useCallback(
    (preset: PresetOption | null) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, {
          selectedCameraAngle: preset as CameraAnglePreset | null,
        });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleCameraLensSelect = useCallback(
    (preset: PresetOption | null) => {
      if (settingsPanelNodeId) {
        updateNodeData(settingsPanelNodeId, {
          selectedCameraLens: preset as CameraLensPreset | null,
        });
      }
    },
    [settingsPanelNodeId, updateNodeData]
  );

  const handleGenerate = useCallback(async () => {
    if (!settingsPanelNodeId || !data) return;

    const connectedInputs = getConnectedInputs(settingsPanelNodeId);
    const finalPrompt = buildImagePrompt(data, connectedInputs);

    if (!finalPrompt) return;

    const requestBody = buildImageGenerationRequest(data, connectedInputs);

    updateNodeData(settingsPanelNodeId, { isGenerating: true, error: undefined });

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

      updateNodeData(settingsPanelNodeId, {
        outputUrl: imageUrls[0],
        outputUrls: imageUrls,
        isGenerating: false,
      });

      addToHistory({
        type: 'image',
        mode: 'single',
        prompt: finalPrompt,
        model: data.model,
        status: 'completed',
        result: { urls: imageUrls },
        settings: {
          aspectRatio: data.aspectRatio,
          imageCount: data.imageCount || 1,
          ...(data.style && { style: data.style }),
          ...(data.resolution && { resolution: data.resolution }),
          ...(data.imageSize && { imageSize: data.imageSize }),
        },
      });
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Generation failed');
      updateNodeData(settingsPanelNodeId, {
        error: errorMessage,
        isGenerating: false,
      });

      addToHistory({
        type: 'image',
        mode: 'single',
        prompt: finalPrompt || data.prompt || '(no prompt)',
        model: data.model,
        status: 'failed',
        error: errorMessage,
        settings: {
          aspectRatio: data.aspectRatio,
          imageCount: data.imageCount || 1,
        },
      });
    }
  }, [settingsPanelNodeId, data, updateNodeData, getConnectedInputs, addToHistory]);

  const handleCompareToggle = useCallback(() => {
    if (!settingsPanelNodeId || !data) return;

    const compatibleModels = getCompatibleImageCompareModels(enabledImageModels, data, getConnectedInputs(settingsPanelNodeId));
    const nextEnabled = !data.compareEnabled;
    updateNodeData(settingsPanelNodeId, {
      compareEnabled: nextEnabled,
      compareModels: nextEnabled
        ? ((data.compareModels?.length ? data.compareModels : buildInitialCompareSelection(data.model, compatibleModels)))
        : data.compareModels,
      compareRunStatus: nextEnabled ? (data.compareRunStatus || 'idle') : 'idle',
    }, true);
  }, [settingsPanelNodeId, data, enabledImageModels, getConnectedInputs, updateNodeData]);

  const handleCompareModelsChange = useCallback((models: string[]) => {
    if (!settingsPanelNodeId) return;
    setCompareEstimateError(null);
    setCompareEstimate(null);
    updateNodeData(settingsPanelNodeId, {
      compareModels: models as ImageModelType[],
      compareEstimateCredits: undefined,
    }, true);
  }, [settingsPanelNodeId, updateNodeData]);

  const handleCompareFill = useCallback(() => {
    if (!settingsPanelNodeId || !data) return;
    const compatibleModels = getCompatibleImageCompareModels(enabledImageModels, data, getConnectedInputs(settingsPanelNodeId));
    handleCompareModelsChange(fillCompareSelection(compatibleModels));
  }, [settingsPanelNodeId, data, enabledImageModels, getConnectedInputs, handleCompareModelsChange]);

  const handleClearCompare = useCallback(() => {
    if (!settingsPanelNodeId) return;
    setCompareEstimate(null);
    setCompareEstimateError(null);
    updateNodeData(settingsPanelNodeId, {
      compareRunStatus: 'idle',
      compareEstimateCredits: undefined,
      compareResults: undefined,
      promotedCompareResultId: undefined,
      compareHistoryId: undefined,
      error: undefined,
    }, true);
  }, [settingsPanelNodeId, updateNodeData]);

  const handleCompareRun = useCallback(async () => {
    if (!settingsPanelNodeId || !data) return;

    const connectedInputs = getConnectedInputs(settingsPanelNodeId);
    try {
      const result = await startImageCompare({
        nodeId: settingsPanelNodeId,
        data,
        connectedInputs,
        updateNodeData,
        history: {
          addToHistory,
          updateHistoryItem,
        },
        confirmImpl: () => true,
      });

      if (!result.cancelled) {
        setCompareEstimateError(null);
      }
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Compare failed');
      updateNodeData(settingsPanelNodeId, {
        error: errorMessage,
        compareRunStatus: 'failed',
      }, true);
      setCompareEstimateError(errorMessage);
    }
  }, [settingsPanelNodeId, data, getConnectedInputs, updateNodeData, addToHistory, updateHistoryItem]);

  useEffect(() => {
    if (!settingsPanelNodeId || !data?.compareEnabled) {
      setCompareEstimate(null);
      setCompareEstimateError(null);
      return;
    }

    const connectedInputs = getConnectedInputs(settingsPanelNodeId);
    const compatibleModels = getCompatibleImageCompareModels(enabledImageModels, data, connectedInputs);
    const selectedModels = (data.compareModels || []).filter((model): model is ImageModelType => compatibleModels.includes(model));
    if (selectedModels.length < 2) {
      setCompareEstimate(null);
      setCompareEstimateError(null);
      if (typeof data.compareEstimateCredits !== 'undefined') {
        updateNodeData(settingsPanelNodeId, { compareEstimateCredits: undefined }, true);
      }
      return;
    }

    let cancelled = false;
    setCompareEstimateError(null);

    fetchImageCompareEstimate(selectedModels)
      .then((estimate) => {
        if (cancelled) return;
        setCompareEstimate(estimate);
        if (data.compareEstimateCredits !== estimate.totalCredits) {
          updateNodeData(settingsPanelNodeId, { compareEstimateCredits: estimate.totalCredits }, true);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setCompareEstimate(null);
        setCompareEstimateError(normalizeApiErrorMessage(error, 'Compare estimate failed'));
        if (typeof data.compareEstimateCredits !== 'undefined') {
          updateNodeData(settingsPanelNodeId, { compareEstimateCredits: undefined }, true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    settingsPanelNodeId,
    data?.compareEnabled,
    data?.compareModels,
    data?.compareEstimateCredits,
    data?.prompt,
    data?.selectedCharacter,
    data?.selectedStyle,
    data?.selectedCameraAngle,
    data?.selectedCameraLens,
    data?.aspectRatio,
    enabledImageModels,
    getConnectedInputs,
    updateNodeData,
  ]);

  if (!settingsPanelNodeId || !anyData) return null;

  // Non-image node types get their own simpler panel
  if (nodeType && nodeType !== 'imageGenerator') {
    return (
      <GenericSettingsPanel
        nodeId={settingsPanelNodeId}
        nodeType={nodeType}
        position={settingsPanelPosition}
        musicData={musicData}
        speechData={speechData}
        videoAudioData={videoAudioData}
        productShotData={productShotData}
        updateNodeData={updateNodeData}
        closeSettingsPanel={closeSettingsPanel}
      />
    );
  }

  if (!data) return null;

  // Check if we have a valid prompt (direct, connected, or from presets)
  const connectedInputs = getConnectedInputs(settingsPanelNodeId);
  const hasValidPrompt = hasValidImagePromptInput(data, connectedInputs);
  const compatibleCompareModels = getCompatibleImageCompareModels(enabledImageModels, data, connectedInputs);
  const compareModelOptions = compatibleCompareModels.map((model) => ({
    value: model,
    label: MODEL_CAPABILITIES[model].label,
    description: MODEL_CAPABILITIES[model].description,
  }));

  // Get model capabilities
  const modelCapabilities = MODEL_CAPABILITIES[data.model];

  // Calculate position to keep panel on screen
  const getPosition = () => {
    if (!settingsPanelPosition) return { left: 0, top: 0 };

    const panelWidth = 280;
    const panelHeight = 560;
    const padding = 20;

    let left = settingsPanelPosition.x;
    let top = settingsPanelPosition.y;

    // Keep panel on screen horizontally
    if (left + panelWidth > window.innerWidth - padding) {
      left = settingsPanelPosition.x - panelWidth - 360; // Move to left of node
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
      className="fixed w-[360px] max-h-[560px] bg-popover border border-border rounded-xl z-50 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.left, top: position.top }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground font-medium">
              {data.name || 'Image Generator'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              onClick={handleGenerate}
              disabled={!hasValidPrompt || data.isGenerating}
              className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full disabled:opacity-40"
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
              onClick={closeSettingsPanel}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Model */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Model
            </label>
            <Select value={data.model} onValueChange={handleModelChange}>
              <SelectTrigger className="w-full bg-muted border-border text-foreground">
                <SelectValue>{modelCapabilities.label}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {visibleImageModels.map(key => (
                  <SelectItem key={key} value={key} className="flex flex-col items-start">
                    <span>{MODEL_CAPABILITIES[key].label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">{modelCapabilities.description}</p>
          </div>

          {/* Presets Section */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
              Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              {/* Character Popover */}
              <PresetPopover
                title="Character"
                icon={<User className="h-4 w-4" />}
                presets={CHARACTER_PRESETS}
                selected={data.selectedCharacter?.type === 'preset' ? data.selectedCharacter : null}
                onSelect={handleCharacterSelect}
                allowCustomUpload={modelCapabilities.supportsReferences}
                customImage={data.selectedCharacter?.type === 'custom' ? data.selectedCharacter.imageUrl : undefined}
                onCustomUpload={handleCharacterUpload}
                onClearCustom={handleClearCustomCharacter}
              />

              {/* Style Popover */}
              <PresetPopover
                title="Style"
                icon={<Palette className="h-4 w-4" />}
                presets={STYLE_PRESETS}
                selected={data.selectedStyle || null}
                onSelect={handleStylePresetSelect}
              />

              {/* Camera Angle Popover */}
              <PresetPopover
                title="Angle"
                icon={<Aperture className="h-4 w-4" />}
                presets={CAMERA_ANGLE_PRESETS}
                selected={data.selectedCameraAngle || null}
                onSelect={handleCameraAngleSelect}
              />

              {/* Camera Lens Popover */}
              <PresetPopover
                title="Lens"
                icon={<Camera className="h-4 w-4" />}
                presets={CAMERA_LENS_PRESETS}
                selected={data.selectedCameraLens || null}
                onSelect={handleCameraLensSelect}
              />
            </div>
          </div>

          {/* Style Selector - for Recraft and Ideogram */}
          {modelCapabilities.styles && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Style
                </label>
                {/* Magic Prompt Toggle - for Ideogram */}
                {modelCapabilities.supportsMagicPrompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMagicPromptToggle}
                    className={`h-7 px-2 gap-1.5 ${
                      data.magicPrompt
                        ? 'text-primary bg-primary/15 hover:bg-primary/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span className="text-xs">Magic</span>
                  </Button>
                )}
              </div>
              <Select
                value={data.style || (modelCapabilities.styles[0] as string)}
                onValueChange={handleStyleChange}
              >
                <SelectTrigger className="w-full bg-muted border-border text-foreground">
                  <SelectValue>
                    {data.model === 'recraft-v3'
                      ? RECRAFT_STYLE_LABELS[(data.style as RecraftStyle) || 'realistic_image']
                      : IDEOGRAM_STYLE_LABELS[(data.style as IdeogramStyle) || 'auto']
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {modelCapabilities.styles.map((style) => (
                    <SelectItem key={style} value={style}>
                      {data.model === 'recraft-v3'
                        ? RECRAFT_STYLE_LABELS[style as RecraftStyle]
                        : IDEOGRAM_STYLE_LABELS[style as IdeogramStyle]
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Advanced Parameters - for SD 3.5 */}
          {modelCapabilities.supportsAdvancedParams && (
            <div className="space-y-4">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">
                Advanced
              </label>

              {/* CFG Scale */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">CFG Scale</span>
                  <span className="text-xs text-muted-foreground/70">{data.cfgScale || 7}</span>
                </div>
                <Slider
                  value={[data.cfgScale || 7]}
                  onValueChange={handleCfgScaleChange}
                  min={1}
                  max={20}
                  step={0.5}
                  className="w-full"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Steps</span>
                  <span className="text-xs text-muted-foreground/70">{data.steps || 30}</span>
                </div>
                <Slider
                  value={[data.steps || 30]}
                  onValueChange={handleStepsChange}
                  min={10}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Strength - only shown when reference is connected */}
              {connectedInputs.referenceUrl && modelCapabilities.supportsStrength && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Strength</span>
                    <span className="text-xs text-muted-foreground/70">{Math.round((data.strength || 0.75) * 100)}%</span>
                  </div>
                  <Slider
                    value={[Math.round((data.strength || 0.75) * 100)]}
                    onValueChange={handleStrengthChange}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">How much to transform the reference image</p>
                </div>
              )}
            </div>
          )}

          {/* References - only show if model supports it */}
          {modelCapabilities.supportsReferences && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
                  References
                </label>
                {(data.references?.length || 0) > 0 && (
                  <span className="text-xs text-muted-foreground/70">
                    {data.references?.length} added
                  </span>
                )}
              </div>

              {/* Uploaded References */}
              {data.references && data.references.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {data.references.map((ref) => (
                    <div key={ref.id} className="relative group">
                      <img
                        src={ref.url}
                        alt={ref.type}
                        className="w-full aspect-square object-cover rounded-lg border border-border"
                      />
                      <div className="absolute inset-0 bg-black/35 dark:bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteReference(ref.id)}
                          className="p-1 bg-red-500 rounded-full hover:bg-red-400 transition-colors"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 text-[10px] px-1 py-0.5 rounded capitalize border border-border/70 bg-white/85 text-foreground/80 backdrop-blur-sm dark:border-white/10 dark:bg-black/60 dark:text-white/80">
                        {ref.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Reference Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => triggerFileUpload('style')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors"
                >
                  <Sparkles className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <span className="text-xs text-muted-foreground">Style</span>
                </button>
                <button
                  onClick={() => triggerFileUpload('character')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors"
                >
                  <User className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <span className="text-xs text-muted-foreground">Character</span>
                </button>
                <button
                  onClick={() => triggerFileUpload('upload')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <span className="text-xs text-muted-foreground">Upload</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}

          {/* Prompt */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Prompt
            </label>
            <textarea
              value={data.prompt}
              onChange={handlePromptChange}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Describe the image you want to generate..."
              className="w-full min-h-[140px] max-h-[260px] bg-muted border border-border rounded-lg p-3 text-foreground text-sm placeholder:text-muted-foreground/60 resize-y overflow-y-auto nodrag nopan nowheel select-text focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Images className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
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
                  emptyMessage={hasValidPrompt ? 'No compatible enabled models' : 'Add a prompt or text input first'}
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
                        {MODEL_CAPABILITIES[item.model].label}: {item.estimatedCredits} cr
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
                    disabled={!hasValidPrompt || (data.compareModels?.length || 0) < 2 || data.compareRunStatus === 'running'}
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
            <p className="text-xs text-red-400">{data.error}</p>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Image Count */}
            <div className="flex items-center bg-muted rounded-lg h-9">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-9 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => settingsPanelNodeId && updateNodeData(settingsPanelNodeId, { imageCount: Math.max(1, (data.imageCount || 1) - 1) })}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm text-foreground w-4 text-center">{data.imageCount || 1}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-9 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => settingsPanelNodeId && updateNodeData(settingsPanelNodeId, { imageCount: Math.min(modelCapabilities.maxImages, (data.imageCount || 1) + 1) })}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Aspect Ratio */}
            <Select value={data.aspectRatio} onValueChange={handleAspectRatioChange}>
              <SelectTrigger className="w-[70px] bg-muted border-0 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modelCapabilities.aspectRatios.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>{getAspectRatioLabel(ratio)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Image Size - for Flux models */}
            {modelCapabilities.imageSizes && (
              <Select value={data.imageSize || 'square_hd'} onValueChange={handleImageSizeChange}>
                <SelectTrigger className="w-[100px] bg-muted border-0 text-foreground text-xs">
                  <SelectValue>{FLUX_IMAGE_SIZES[data.imageSize || 'square_hd'].label}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {modelCapabilities.imageSizes.map((size) => (
                    <SelectItem key={size} value={size} className="text-xs">
                      {FLUX_IMAGE_SIZES[size].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Resolution - for Nano Banana */}
            {modelCapabilities.resolutions && (
              <Select value={data.resolution || '1K'} onValueChange={handleResolutionChange}>
                <SelectTrigger className="w-[70px] bg-muted border-0 text-foreground">
                  <SelectValue>{NANO_BANANA_RESOLUTIONS[data.resolution || '1K'].label}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {modelCapabilities.resolutions.map((res) => (
                    <SelectItem key={res} value={res}>
                      <div className="flex flex-col">
                        <span>{NANO_BANANA_RESOLUTIONS[res].label}</span>
                        <span className="text-xs text-muted-foreground">{NANO_BANANA_RESOLUTIONS[res].description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Dimensions preview */}
          {(() => {
            const dims = getApproxDimensions(data.aspectRatio, data.model, data.resolution);
            return (
              <p className="text-xs text-muted-foreground">
                Output: ~{dims.width} × {dims.height}px
              </p>
            );
          })()}
        </div>
      </div>
  );
}

// Background options for ProductShot
const BACKGROUND_OPTIONS: { value: ProductShotBackground; label: string }[] = [
  { value: 'studio-white', label: 'Studio White' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'dark-moody', label: 'Dark & Moody' },
];

const LIGHTING_OPTIONS: { value: ProductShotLighting; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'natural', label: 'Natural' },
  { value: 'rim-light', label: 'Rim Light' },
];

const SHOT_COUNTS = [4, 6, 8] as const;

// --- Generic Settings Panel for non-image node types ---

function GenericSettingsPanel({
  nodeId,
  nodeType,
  position,
  musicData,
  speechData,
  videoAudioData,
  productShotData,
  updateNodeData,
  closeSettingsPanel,
}: {
  nodeId: string;
  nodeType: string;
  position: { x: number; y: number } | null;
  musicData?: MusicGeneratorNodeData;
  speechData?: SpeechNodeData;
  videoAudioData?: VideoAudioNodeData;
  productShotData?: ProductShotNodeData;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, silent?: boolean) => void;
  closeSettingsPanel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if ((target as Element).closest?.('[data-radix-popper-content-wrapper], [data-slot="select-content"]')) return;
      closeSettingsPanel();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettingsPanel();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeSettingsPanel]);

  const getPosition = () => {
    if (!position) return { left: 0, top: 0 };
    const panelWidth = 280;
    const panelHeight = 400;
    const padding = 20;
    let left = position.x;
    let top = position.y;
    if (left + panelWidth > window.innerWidth - padding) {
      left = position.x - panelWidth - 360;
    }
    if (top + panelHeight > window.innerHeight - padding) {
      top = window.innerHeight - panelHeight - padding;
    }
    return { left: Math.max(padding, left), top: Math.max(padding, top) };
  };

  const pos = getPosition();

  const panelTitle = nodeType === 'musicGenerator' ? 'Music Settings'
    : nodeType === 'speech' ? 'Speech Settings'
    : nodeType === 'videoAudio' ? 'Video Audio Settings'
    : nodeType === 'productShot' ? 'Product Shot Settings'
    : 'Settings';

  const panelIcon = nodeType === 'musicGenerator' ? <Music className="h-4 w-4 text-muted-foreground" />
    : nodeType === 'speech' ? <Mic className="h-4 w-4 text-muted-foreground" />
    : nodeType === 'videoAudio' ? <Film className="h-4 w-4 text-muted-foreground" />
    : nodeType === 'productShot' ? <Camera className="h-4 w-4 text-muted-foreground" />
    : null;

  return (
    <div
      ref={panelRef}
      className="fixed w-[300px] max-h-[480px] bg-popover border border-border rounded-xl z-50 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          {panelIcon}
          <span className="text-foreground font-medium text-sm">{panelTitle}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={closeSettingsPanel}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {nodeType === 'musicGenerator' && musicData && (
          <MusicSettingsContent nodeId={nodeId} data={musicData} updateNodeData={updateNodeData} />
        )}
        {nodeType === 'speech' && speechData && (
          <SpeechSettingsContent nodeId={nodeId} data={speechData} updateNodeData={updateNodeData} />
        )}
        {nodeType === 'videoAudio' && videoAudioData && (
          <VideoAudioSettingsContent nodeId={nodeId} data={videoAudioData} updateNodeData={updateNodeData} />
        )}
        {nodeType === 'productShot' && productShotData && (
          <ProductShotSettingsContent nodeId={nodeId} data={productShotData} updateNodeData={updateNodeData} />
        )}
      </div>
    </div>
  );
}

// --- Music Settings ---
function MusicSettingsContent({ nodeId, data, updateNodeData }: {
  nodeId: string;
  data: MusicGeneratorNodeData;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, silent?: boolean) => void;
}) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Guidance Scale</span>
          <span className="text-xs text-muted-foreground/70">{data.guidanceScale ?? 7}</span>
        </div>
        <Slider
          value={[data.guidanceScale ?? 7]}
          onValueChange={(v) => updateNodeData(nodeId, { guidanceScale: v[0] })}
          min={1}
          max={15}
          step={0.5}
          className="w-full"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">Higher values follow the prompt more closely</p>
      </div>
    </>
  );
}

// --- Speech Settings ---
function SpeechSettingsContent({ nodeId, data, updateNodeData }: {
  nodeId: string;
  data: SpeechNodeData;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, silent?: boolean) => void;
}) {
  const model = (data.model || 'elevenlabs-tts') as SpeechModelType;
  const capabilities = SPEECH_MODEL_CAPABILITIES[model];

  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Model</label>
        <Select
          value={model}
          onValueChange={(value) =>
            updateNodeData(nodeId, {
              model: value as SpeechModelType,
              ...(value === 'elevenlabs-tts' ? {} : { mode: 'single' }),
            })
          }
        >
          <SelectTrigger className="w-full bg-muted border-border text-foreground">
            <SelectValue>{capabilities.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {SPEECH_MODEL_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {SPEECH_MODEL_CAPABILITIES[option].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1.5">{capabilities.description}</p>
      </div>

      {model === 'tada-3b-tts' && (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Language</label>
          <Select
            value={data.language || 'en'}
            onValueChange={(value) => updateNodeData(nodeId, { language: value as TadaLanguage })}
          >
            <SelectTrigger className="w-full bg-muted border-border text-foreground">
              <SelectValue>{TADA_LANGUAGE_LABELS[(data.language || 'en') as TadaLanguage]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {Object.entries(TADA_LANGUAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {capabilities.requiresAudioReference && (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Reference Transcript</label>
          <textarea
            value={data.referenceTranscript || ''}
            onChange={(e) => updateNodeData(nodeId, { referenceTranscript: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={model === 'tada-3b-tts' ? 'Optional. Useful for non-English reference audio.' : 'Optional transcript for the reference audio clip.'}
            className="w-full min-h-[72px] bg-muted border border-border rounded-lg p-3 text-foreground text-sm placeholder:text-muted-foreground/60 resize-y overflow-y-auto nodrag nopan nowheel select-text focus:outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">Connect an audio node or uploaded audio clip to the Speech node to use voice cloning.</p>
        </div>
      )}

      {model !== 'lux-tts' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Speed</span>
            <span className="text-xs text-muted-foreground/70">{(data.speed ?? 1).toFixed(1)}x</span>
          </div>
          <Slider
            value={[data.speed ?? 1]}
            onValueChange={(v) => updateNodeData(nodeId, { speed: v[0] })}
            min={model === 'tada-3b-tts' ? 0.5 : 0.7}
            max={model === 'tada-3b-tts' ? 2 : 1.2}
            step={0.05}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {model === 'tada-3b-tts'
              ? 'Controls the output speaking rate.'
              : 'Higher values read the text faster.'}
          </p>
        </div>
      )}

      {model === 'elevenlabs-tts' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Stability</span>
            <span className="text-xs text-muted-foreground/70">{Math.round((data.stability ?? 0.5) * 100)}%</span>
          </div>
          <Slider
            value={[data.stability ?? 0.5]}
            onValueChange={(v) => updateNodeData(nodeId, { stability: v[0] })}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">Higher = more consistent, lower = more expressive</p>
        </div>
      )}
    </>
  );
}

// --- Video Audio Settings ---
function VideoAudioSettingsContent({ nodeId, data, updateNodeData }: {
  nodeId: string;
  data: VideoAudioNodeData;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, silent?: boolean) => void;
}) {
  const model = (data.model || 'mmaudio-v2') as VideoAudioModelType;
  const capabilities = VIDEO_AUDIO_MODEL_CAPABILITIES[model];

  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Model</label>
        <Select
          value={model}
          onValueChange={(value) => updateNodeData(nodeId, { model: value as VideoAudioModelType })}
        >
          <SelectTrigger className="w-full bg-muted border-border text-foreground">
            <SelectValue>{capabilities.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {VIDEO_AUDIO_MODEL_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {VIDEO_AUDIO_MODEL_CAPABILITIES[option].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1.5">{capabilities.description}</p>
      </div>

      {model === 'mmaudio-v2' ? (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Duration</span>
              <span className="text-xs text-muted-foreground/70">{data.duration ?? 8}s</span>
            </div>
            <Slider
              value={[data.duration ?? 8]}
              onValueChange={(v) => updateNodeData(nodeId, { duration: v[0] })}
              min={1}
              max={30}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">CFG Strength</span>
              <span className="text-xs text-muted-foreground/70">{data.cfgStrength ?? 4.5}</span>
            </div>
            <Slider
              value={[data.cfgStrength ?? 4.5]}
              onValueChange={(v) => updateNodeData(nodeId, { cfgStrength: v[0] })}
              min={1}
              max={10}
              step={0.5}
              className="w-full"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">Higher values follow the prompt more closely</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Negative Prompt</label>
            <textarea
              value={data.negativePrompt || ''}
              onChange={(e) => updateNodeData(nodeId, { negativePrompt: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Sounds to avoid..."
              className="w-full min-h-[80px] bg-muted border border-border rounded-lg p-3 text-foreground text-sm placeholder:text-muted-foreground/60 resize-y overflow-y-auto nodrag nopan nowheel select-text focus:outline-none focus:border-primary"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Sync Mode</label>
            <Select
              value={data.syncMode || 'cut_off'}
              onValueChange={(value) => updateNodeData(nodeId, { syncMode: value as SyncLipsyncMode })}
            >
              <SelectTrigger className="w-full bg-muted border-border text-foreground">
                <SelectValue>{SYNC_LIPSYNC_MODE_LABELS[(data.syncMode || 'cut_off') as SyncLipsyncMode]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {Object.entries(SYNC_LIPSYNC_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Connect a video node and an audio node. Sync Lipsync uses the incoming audio directly and ignores prompt tuning.
          </p>
        </>
      )}
    </>
  );
}

// --- Product Shot Settings ---
function ProductShotSettingsContent({ nodeId, data, updateNodeData }: {
  nodeId: string;
  data: ProductShotNodeData;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, silent?: boolean) => void;
}) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Shot Count</label>
        <Select
          value={String(data.shotCount)}
          onValueChange={(v) => updateNodeData(nodeId, { shotCount: Number(v) })}
        >
          <SelectTrigger className="w-full bg-muted border-border text-foreground">
            <SelectValue>{data.shotCount} shots</SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {SHOT_COUNTS.map((count) => (
              <SelectItem key={count} value={String(count)}>{count} shots</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Background</label>
        <Select
          value={data.background}
          onValueChange={(v) => updateNodeData(nodeId, { background: v as ProductShotBackground })}
        >
          <SelectTrigger className="w-full bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {BACKGROUND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Lighting</label>
        <Select
          value={data.lighting}
          onValueChange={(v) => updateNodeData(nodeId, { lighting: v as ProductShotLighting })}
        >
          <SelectTrigger className="w-full bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {LIGHTING_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
