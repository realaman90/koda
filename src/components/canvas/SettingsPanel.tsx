'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCanvasStore } from '@/stores/canvas-store';
import type { ImageGeneratorNodeData, ImageReference, FluxImageSize, NanoBananaResolution, RecraftStyle, IdeogramStyle, CharacterPreset, StylePreset, CameraAnglePreset, CameraLensPreset, PresetOption, CharacterSelection } from '@/lib/types';
import { MODEL_CAPABILITIES, ENABLED_IMAGE_MODELS, FLUX_IMAGE_SIZES, NANO_BANANA_RESOLUTIONS, RECRAFT_STYLE_LABELS, IDEOGRAM_STYLE_LABELS, getApproxDimensions } from '@/lib/types';
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
} from 'lucide-react';

export function SettingsPanel() {
  const settingsPanelNodeId = useCanvasStore((state) => state.settingsPanelNodeId);
  const settingsPanelPosition = useCanvasStore((state) => state.settingsPanelPosition);
  const closeSettingsPanel = useCanvasStore((state) => state.closeSettingsPanel);
  const getNode = useCanvasStore((state) => state.getNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);

  const node = settingsPanelNodeId ? getNode(settingsPanelNodeId) : null;
  const data = node?.data as ImageGeneratorNodeData | undefined;

  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<'style' | 'character' | 'upload'>('upload');

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
      const radixSelect = (target as Element).closest?.('[data-radix-popper-content-wrapper]');
      if (radixSelect) {
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

    // Get connected inputs
    const connectedInputs = getConnectedInputs(settingsPanelNodeId);

    // Build final prompt with preset modifiers
    const promptParts: string[] = [];

    // Add character modifier
    if (data.selectedCharacter?.type === 'preset') {
      promptParts.push(data.selectedCharacter.promptModifier);
    }

    // Add style preset modifier
    if (data.selectedStyle) {
      promptParts.push(data.selectedStyle.promptModifier);
    }

    // Add camera angle modifier
    if (data.selectedCameraAngle) {
      promptParts.push(data.selectedCameraAngle.promptModifier);
    }

    // Add camera lens modifier
    if (data.selectedCameraLens) {
      promptParts.push(data.selectedCameraLens.promptModifier);
    }

    // Add connected text content
    if (connectedInputs.textContent) {
      promptParts.push(connectedInputs.textContent);
    }

    // Add user prompt
    if (data.prompt) {
      promptParts.push(data.prompt);
    }

    const finalPrompt = promptParts.join(', ');

    if (!finalPrompt) return;

    updateNodeData(settingsPanelNodeId, { isGenerating: true, error: undefined });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: data.model,
          aspectRatio: data.aspectRatio,
          imageSize: data.imageSize || 'square_hd',
          resolution: data.resolution || '1K',
          imageCount: data.imageCount || 1,
          referenceUrl: connectedInputs.referenceUrl,
          // Model-specific params
          style: data.style,
          magicPrompt: data.magicPrompt,
          cfgScale: data.cfgScale,
          steps: data.steps,
          strength: data.strength,
        }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();
      const imageUrls: string[] = result.imageUrls || [result.imageUrl];

      updateNodeData(settingsPanelNodeId, {
        outputUrl: imageUrls[0],
        outputUrls: imageUrls,
        isGenerating: false,
      });
    } catch (error) {
      updateNodeData(settingsPanelNodeId, {
        error: error instanceof Error ? error.message : 'Generation failed',
        isGenerating: false,
      });
    }
  }, [settingsPanelNodeId, data, updateNodeData, getConnectedInputs]);

  if (!settingsPanelNodeId || !data) return null;

  // Check if we have a valid prompt (direct, connected, or from presets)
  const connectedInputs = getConnectedInputs(settingsPanelNodeId);
  const hasPresetSelected = !!(
    data.selectedCharacter ||
    data.selectedStyle ||
    data.selectedCameraAngle ||
    data.selectedCameraLens
  );
  const hasValidPrompt = !!(data.prompt || connectedInputs.textContent || hasPresetSelected);

  // Get model capabilities
  const modelCapabilities = MODEL_CAPABILITIES[data.model];

  // Calculate position to keep panel on screen
  const getPosition = () => {
    if (!settingsPanelPosition) return { left: 0, top: 0 };

    const panelWidth = 280;
    const panelHeight = 500;
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
      className="fixed w-[280px] max-h-[500px] bg-popover border border-border rounded-xl z-50 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
              className="h-8 w-8 bg-primary hover:bg-[var(--accent-primary-hover)] text-white rounded-full disabled:opacity-40"
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
                {ENABLED_IMAGE_MODELS.map(key => (
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
              {connectedInputs.referenceUrl && (
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
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteReference(ref.id)}
                          className="p-1 bg-red-500 rounded-full hover:bg-red-400 transition-colors"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 text-[10px] px-1 py-0.5 bg-black/60 text-white/80 rounded capitalize">
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
              placeholder="Describe the image you want to generate..."
              className="w-full h-[120px] bg-muted border border-border rounded-lg p-3 text-foreground text-sm placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary"
            />
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
                  <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
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
