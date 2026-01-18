'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
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
import { useCanvasStore, createMediaNode } from '@/stores/canvas-store';
import type { ImageGeneratorNode as ImageGeneratorNodeType, RecraftStyle, IdeogramStyle } from '@/lib/types';
import { MODEL_CAPABILITIES, getApproxDimensions, FLUX_IMAGE_SIZES, RECRAFT_STYLE_LABELS, IDEOGRAM_STYLE_LABELS, type FluxImageSize, type NanoBananaResolution } from '@/lib/types';
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
  Loader2,
  Wand2,
  Sparkle,
} from 'lucide-react';

function ImageGeneratorNodeComponent({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<ImageGeneratorNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const addNode = useCanvasStore((state) => state.addNode);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const updateNodeInternals = useUpdateNodeInternals();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Image Generator');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const modelCapabilities = MODEL_CAPABILITIES[data.model];
  const maxRefs = modelCapabilities.maxReferences || 1;
  const refHandleCount = data.refHandleCount || 1;

  // Update node internals when ref handle count changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, refHandleCount, updateNodeInternals]);

  const handleAddRefHandle = useCallback(() => {
    if (refHandleCount < maxRefs) {
      updateNodeData(id, { refHandleCount: refHandleCount + 1 });
    }
  }, [id, refHandleCount, maxRefs, updateNodeData]);

  const handleRemoveRefHandle = useCallback(() => {
    if (refHandleCount > 1) {
      updateNodeData(id, { refHandleCount: refHandleCount - 1 });
    }
  }, [id, refHandleCount, updateNodeData]);

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
    // Get connected inputs from TextNode and MediaNode
    const connectedInputs = getConnectedInputs(id);

    // Merge connected text with prompt (connected text takes priority, or append if prompt exists)
    let finalPrompt = data.prompt || '';
    if (connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (data.prompt ? `\n${data.prompt}` : '');
    }

    if (!finalPrompt) {
      toast.error('Please enter a prompt or connect a text node');
      return;
    }

    // Collect all reference URLs (main reference + additional refs)
    const allReferenceUrls: string[] = [];
    if (connectedInputs.referenceUrl) {
      allReferenceUrls.push(connectedInputs.referenceUrl);
    }
    if (connectedInputs.referenceUrls) {
      allReferenceUrls.push(...connectedInputs.referenceUrls);
    }

    const imageCount = data.imageCount || 1;
    updateNodeData(id, { isGenerating: true, error: undefined });

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
          imageCount,
          // Pass single referenceUrl for backwards compatibility
          referenceUrl: connectedInputs.referenceUrl,
          // Pass all references as array for multi-reference models (NanoBanana supports up to 14)
          referenceUrls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [id, data.prompt, data.model, data.aspectRatio, data.imageCount, updateNodeData, getConnectedInputs, addNode, positionAbsoluteX, positionAbsoluteY]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
    toast.success('Node deleted');
  }, [id, deleteNode]);

  const handleOpenSettings = useCallback((e: React.MouseEvent) => {
    // Position popover to the right of the node
    const rect = (e.currentTarget as HTMLElement).closest('.react-flow__node')?.getBoundingClientRect();
    if (rect) {
      openSettingsPanel(id, { x: rect.right + 10, y: rect.top });
    }
  }, [id, openSettingsPanel]);

  const handleDownload = useCallback(async () => {
    if (!data.outputUrl) return;

    try {
      const response = await fetch(data.outputUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spaces-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download image');
    }
  }, [data.outputUrl]);

  // Get dimensions for badge
  const dimensions = getApproxDimensions(data.aspectRatio, data.model, data.resolution);

  // Check if we have a valid prompt (either direct or from connected TextNode)
  const connectedInputs = getConnectedInputs(id);
  const hasValidPrompt = !!(data.prompt || connectedInputs.textContent);

  return (
    <div className="relative">
      {/* Floating Toolbar - appears above node when selected */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur rounded-lg px-2 py-1.5 border shadow-xl z-10 node-toolbar-floating">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleGenerate}
            disabled={!hasValidPrompt || data.isGenerating}
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
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-image)' }}>
        <div className="relative h-4 w-4">
          <ImageIcon className="h-4 w-4" />
          <Sparkle className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-current" />
        </div>
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
                setNodeName(data.name || 'Image Generator');
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
            {data.name || 'Image Generator'}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[420px] rounded-2xl overflow-hidden
          transition-all duration-150
          ${data.isGenerating
            ? 'ring-[2.5px] ring-teal-500 shadow-lg shadow-teal-500/20 animate-pulse-glow-teal'
            : selected
              ? 'ring-[2.5px] ring-white/20'
              : ''
          }
        `}
        style={{
          backgroundColor: data.outputUrl ? 'transparent' : 'var(--node-card-bg)',
          minHeight: refHandleCount > 1 ? `${280 + (refHandleCount - 1) * 45}px` : undefined,
        }}
      >
        {/* Content Area */}
        <div className="relative">
          {/* Loading State */}
          {data.isGenerating ? (
            <div className="p-4 min-h-[200px] flex flex-col items-center justify-center gap-4 rounded-2xl" style={{ backgroundColor: 'var(--node-card-bg)' }}>
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-border border-t-teal-500 animate-spin" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-teal-500 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-foreground text-sm font-medium">Generating...</p>
                <p className="text-muted-foreground text-xs mt-1">This may take a moment</p>
              </div>
            </div>
          ) : data.outputUrl ? (
            /* Generated Image - Freepik Style */
            <div className="relative">
              <img
                src={data.outputUrl}
                alt="Generated"
                className="w-full h-auto rounded-2xl"
              />
              {/* Dimension badge */}
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded text-xs text-zinc-300 font-medium">
                {dimensions.width} × {dimensions.height}
              </div>
              {/* Download button */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDownload}
                className="absolute top-3 right-20 h-7 w-7 bg-black/50 backdrop-blur-sm text-zinc-300 hover:text-white hover:bg-black/70 rounded"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {/* Prompt text overlay */}
              <div className="absolute bottom-14 left-3 right-3">
                <p className="text-white/60 text-sm">
                  {connectedInputs.textContent ? 'Prompt (connected)' : data.prompt ? data.prompt.slice(0, 50) + (data.prompt.length > 50 ? '...' : '') : ''}
                </p>
              </div>
              {/* Floating Toolbar - inside image at bottom */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 px-2 py-2 bg-black/40 backdrop-blur-md rounded-xl">
                <SearchableSelect
                  value={data.model}
                  onValueChange={handleModelChange}
                  options={Object.entries(MODEL_CAPABILITIES).map(([key, cap]) => ({
                    value: key,
                    label: cap.label,
                    description: cap.description,
                  }))}
                  placeholder="Select model"
                  searchPlaceholder="Search models..."
                  triggerClassName="max-w-[120px]"
                />
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
                <div className="flex items-center bg-muted/80 rounded-md h-7">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-5 text-muted-foreground hover:text-foreground hover:bg-transparent p-0"
                    onClick={() => updateNodeData(id, { imageCount: Math.max(1, (data.imageCount || 1) - 1) })}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-foreground w-3 text-center">{data.imageCount || 1}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-5 text-muted-foreground hover:text-foreground hover:bg-transparent p-0"
                    onClick={() => updateNodeData(id, { imageCount: Math.min(modelCapabilities.maxImages, (data.imageCount || 1) + 1) })}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleOpenSettings}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={handleGenerate}
                  disabled={!hasValidPrompt || data.isGenerating}
                  size="icon-sm"
                  className="h-8 w-8 min-w-8 bg-teal-500 hover:bg-teal-400 text-white rounded-full disabled:opacity-40 shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* Prompt Input - Dark card style */
            <>
              <div className="p-4 min-h-[220px]">
                <textarea
                  value={data.prompt}
                  onChange={handlePromptChange}
                  placeholder="Describe the image you want to generate..."
                  className="w-full h-[180px] bg-transparent border-none text-sm resize-none focus:outline-none node-input"
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
              {/* Error Display */}
              {data.error && (
                <p className="text-xs text-red-400 px-4 pb-2">{data.error}</p>
              )}
              {/* Bottom Toolbar */}
              <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5 node-bottom-toolbar">
                <SearchableSelect
                  value={data.model}
                  onValueChange={handleModelChange}
                  options={Object.entries(MODEL_CAPABILITIES).map(([key, cap]) => ({
                    value: key,
                    label: cap.label,
                    description: cap.description,
                  }))}
                  placeholder="Select model"
                  searchPlaceholder="Search models..."
                  triggerClassName="max-w-[120px]"
                />
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
                {modelCapabilities.resolutions && (
                  <Select value={data.resolution || '1K'} onValueChange={handleResolutionChange}>
                    <SelectTrigger className="h-7 w-auto bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted">
                      <SelectValue>{data.resolution || '1K'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {modelCapabilities.resolutions.map((res) => (
                        <SelectItem key={res} value={res} className="text-xs">{res}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {modelCapabilities.imageSizes && (
                  <Select value={data.imageSize || 'square_hd'} onValueChange={handleImageSizeChange}>
                    <SelectTrigger className="h-7 w-auto max-w-[90px] bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted [&>span]:truncate">
                      <SelectValue>{FLUX_IMAGE_SIZES[data.imageSize || 'square_hd'].label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {modelCapabilities.imageSizes.map((size) => (
                        <SelectItem key={size} value={size} className="text-xs">{FLUX_IMAGE_SIZES[size].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {modelCapabilities.styles && (
                  <Select value={data.style || (modelCapabilities.styles[0] as string)} onValueChange={handleStyleChange}>
                    <SelectTrigger className="h-7 w-auto max-w-[90px] bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted [&>span]:truncate">
                      <SelectValue>
                        {data.model === 'recraft-v3'
                          ? RECRAFT_STYLE_LABELS[(data.style as RecraftStyle) || 'realistic_image']
                          : IDEOGRAM_STYLE_LABELS[(data.style as IdeogramStyle) || 'auto']
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {modelCapabilities.styles.map((style) => (
                        <SelectItem key={style} value={style} className="text-xs">
                          {data.model === 'recraft-v3'
                            ? RECRAFT_STYLE_LABELS[style as RecraftStyle]
                            : IDEOGRAM_STYLE_LABELS[style as IdeogramStyle]
                          }
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {modelCapabilities.supportsMagicPrompt && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleMagicPromptToggle}
                    className={`h-7 w-7 shrink-0 ${
                      data.magicPrompt
                        ? 'text-purple-400 bg-purple-500/20 hover:bg-purple-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    title={data.magicPrompt ? 'Magic Prompt ON' : 'Magic Prompt OFF'}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <div className="flex items-center bg-muted/80 rounded-md h-7">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-5 text-muted-foreground hover:text-foreground hover:bg-transparent p-0"
                    onClick={() => updateNodeData(id, { imageCount: Math.max(1, (data.imageCount || 1) - 1) })}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-foreground w-3 text-center">{data.imageCount || 1}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-5 text-muted-foreground hover:text-foreground hover:bg-transparent p-0"
                    onClick={() => updateNodeData(id, { imageCount: Math.min(modelCapabilities.maxImages, (data.imageCount || 1) + 1) })}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleOpenSettings}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1 min-w-0" />
                <Button
                  onClick={handleGenerate}
                  disabled={!hasValidPrompt || data.isGenerating}
                  size="icon-sm"
                  className="h-8 w-8 min-w-8 bg-teal-500 hover:bg-teal-400 text-white rounded-full disabled:opacity-40 shrink-0"
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Input Handles - Left side */}
      {/* Text Input */}
      <div className="absolute -left-3 group" style={{ top: modelCapabilities.inputType !== 'text-only' ? '110px' : '50%', transform: modelCapabilities.inputType === 'text-only' ? 'translateY(-50%)' : undefined }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="text"
            className="!relative !transform-none !w-6 !h-6 !border-2 !rounded-md node-handle hover:!border-blue-500"
          />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
        <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Text
        </span>
      </div>
      {/* Reference Image Inputs - only shown for models that support image input */}
      {modelCapabilities.inputType !== 'text-only' && (
        <>
          {/* Dynamic reference handles */}
          {Array.from({ length: refHandleCount }).map((_, index) => {
            const baseTop = 160; // Start at 160px from top
            const spacing = 40; // 40px spacing between handles
            const top = baseTop + index * spacing;
            return (
              <div key={`ref-${index}`} className="absolute -left-3 group" style={{ top: `${top}px` }}>
                <div className="relative">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={index === 0 ? 'reference' : `ref${index + 1}`}
                    className="!relative !transform-none !w-6 !h-6 !border-2 !rounded-md node-handle hover:!border-blue-500"
                  />
                  <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                </div>
                <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
                  {refHandleCount > 1 ? `Ref ${index + 1}` : 'Reference'}
                </span>
              </div>
            );
          })}
          {/* Add/Remove ref buttons - only for multi-ref models */}
          {maxRefs > 1 && (
            <div className="absolute -left-3 flex flex-col gap-0.5" style={{ top: `${160 + refHandleCount * 40 + 10}px` }}>
              {refHandleCount < maxRefs && (
                <button
                  onClick={handleAddRefHandle}
                  className="w-6 h-5 rounded flex items-center justify-center transition-colors hover:border-blue-500"
                  style={{ backgroundColor: 'var(--handle-bg)', borderWidth: '1px', borderColor: 'var(--handle-border)', color: 'var(--text-muted)' }}
                  title={`Add reference (${refHandleCount}/${maxRefs})`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
              {refHandleCount > 1 && (
                <button
                  onClick={handleRemoveRefHandle}
                  className="w-6 h-5 rounded flex items-center justify-center transition-colors hover:border-red-500"
                  style={{ backgroundColor: 'var(--handle-bg)', borderWidth: '1px', borderColor: 'var(--handle-border)', color: 'var(--text-muted)' }}
                  title="Remove reference"
                >
                  <Minus className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Output Handle - Right side */}
      <div className="absolute -right-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-6 !h-6 !border-2 !rounded-md node-handle hover:!border-green-500"
          />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
        <span className="absolute right-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated image
        </span>
      </div>
    </div>
  );
}

export const ImageGeneratorNode = memo(ImageGeneratorNodeComponent);
