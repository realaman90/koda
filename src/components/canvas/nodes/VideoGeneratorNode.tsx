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
import { useCanvasStore } from '@/stores/canvas-store';
import type { VideoGeneratorNode as VideoGeneratorNodeType } from '@/lib/types';
import { VIDEO_MODEL_CAPABILITIES, type VideoModelType, type VideoAspectRatio, type VideoDuration } from '@/lib/types';
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
} from 'lucide-react';

function VideoGeneratorNodeComponent({ id, data, selected }: NodeProps<VideoGeneratorNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const updateNodeInternals = useUpdateNodeInternals();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Video Generator');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get model capabilities
  const modelCapabilities = VIDEO_MODEL_CAPABILITIES[data.model];
  const { inputMode } = modelCapabilities;

  // Update node internals when input mode changes (handles change)
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputMode, updateNodeInternals]);

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
      updateNodeData(id, { model: value as VideoModelType });
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

  const handleGenerate = useCallback(async () => {
    const connectedInputs = getConnectedInputs(id);
    const modelCaps = VIDEO_MODEL_CAPABILITIES[data.model];

    let finalPrompt = data.prompt || '';
    if (connectedInputs.textContent) {
      finalPrompt = connectedInputs.textContent + (data.prompt ? `\n${data.prompt}` : '');
    }

    // Validate based on input mode
    if (modelCaps.inputMode === 'first-last-frame') {
      if (!connectedInputs.firstFrameUrl || !connectedInputs.lastFrameUrl) {
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

    if (!finalPrompt && !connectedInputs.referenceUrl && !connectedInputs.firstFrameUrl) {
      toast.error('Please enter a prompt or connect an image');
      return;
    }

    updateNodeData(id, { isGenerating: true, error: undefined, progress: 0 });

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: data.model,
          aspectRatio: data.aspectRatio,
          duration: data.duration,
          referenceUrl: connectedInputs.referenceUrl,
          firstFrameUrl: connectedInputs.firstFrameUrl,
          lastFrameUrl: connectedInputs.lastFrameUrl,
          referenceUrls: connectedInputs.referenceUrls,
          generateAudio: data.generateAudio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Video generation failed');
      }

      const result = await response.json();

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
  }, [id, data.prompt, data.model, data.aspectRatio, data.duration, data.generateAudio, updateNodeData, getConnectedInputs]);

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

  // Determine if we have valid inputs based on mode
  const hasValidInput = (() => {
    const hasPrompt = !!(data.prompt || connectedInputs.textContent);

    switch (inputMode) {
      case 'text':
        return hasPrompt;
      case 'single-image':
        return hasPrompt || !!connectedInputs.referenceUrl;
      case 'first-last-frame':
        return !!connectedInputs.firstFrameUrl && !!connectedInputs.lastFrameUrl;
      case 'multi-reference':
        return hasPrompt && (!!connectedInputs.referenceUrls?.length || !!connectedInputs.referenceUrl);
      default:
        return hasPrompt;
    }
  })();

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-800/90 backdrop-blur rounded-lg px-2 py-1.5 border border-zinc-700/50 shadow-xl z-10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700/50"
            onClick={handleGenerate}
            disabled={!hasValidInput || data.isGenerating}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          {data.outputUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700/50"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-zinc-400 text-sm font-medium">
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
            className="bg-transparent border-b border-zinc-600 outline-none text-zinc-300 px-0.5 min-w-[100px]"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingName(true)}
            className="cursor-text hover:text-zinc-300 transition-colors"
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
          ${selected
            ? 'ring-[2.5px] ring-purple-500 shadow-lg shadow-purple-500/10'
            : 'ring-1 ring-zinc-800 hover:ring-zinc-700'
          }
        `}
        style={{ backgroundColor: '#1a1a1c' }}
      >
        {/* Content Area */}
        <div className="relative">
          {/* Loading State */}
          {data.isGenerating ? (
            <div className="p-4 min-h-[200px] flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-700 border-t-purple-500 animate-spin" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-purple-500 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-zinc-300 text-sm font-medium">Generating video...</p>
                <p className="text-zinc-500 text-xs mt-1">This may take a few minutes</p>
              </div>
              {/* Progress bar */}
              {data.progress !== undefined && data.progress > 0 && (
                <div className="w-full max-w-[200px] h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : data.outputUrl ? (
            /* Video Preview */
            <div className="relative">
              <video
                ref={videoRef}
                src={data.outputUrl}
                poster={data.thumbnailUrl}
                controls
                className="w-full h-auto"
                style={{ maxHeight: '300px' }}
              />
              {/* Duration badge */}
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-xs text-zinc-300 font-medium">
                {data.duration}s
              </div>
            </div>
          ) : (
            /* Prompt Input */
            <div className="p-4 min-h-[180px]">
              <textarea
                value={data.prompt}
                onChange={handlePromptChange}
                placeholder="Describe the video you want to generate..."
                className="w-full h-[140px] bg-transparent border-none text-zinc-300 text-sm placeholder:text-zinc-600 resize-none focus:outline-none"
              />
            </div>
          )}

          {/* Error Display */}
          {data.error && (
            <p className="text-xs text-red-400 px-4 pb-2">{data.error}</p>
          )}
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5 bg-zinc-900/50">
          {/* Model Selector */}
          <SearchableSelect
            value={data.model}
            onValueChange={handleModelChange}
            options={Object.entries(VIDEO_MODEL_CAPABILITIES).map(([key, cap]) => ({
              value: key,
              label: cap.label,
              description: cap.description,
            }))}
            placeholder="Select model"
            searchPlaceholder="Search models..."
            triggerClassName="max-w-[110px]"
          />

          {/* Aspect Ratio */}
          <Select value={data.aspectRatio} onValueChange={handleAspectRatioChange}>
            <SelectTrigger className="h-7 w-auto bg-zinc-800/80 border-0 text-xs text-zinc-300 gap-1 px-2 rounded-md hover:bg-zinc-700/80">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-zinc-500 rounded-[2px]" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {modelCapabilities.aspectRatios.map((ratio) => (
                <SelectItem key={ratio} value={ratio} className="text-xs">{ratio}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Duration */}
          <Select value={String(data.duration)} onValueChange={handleDurationChange}>
            <SelectTrigger className="h-7 w-auto bg-zinc-800/80 border-0 text-xs text-zinc-300 gap-1 px-2 rounded-md hover:bg-zinc-700/80">
              <SelectValue>{data.duration}s</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {modelCapabilities.durations.map((dur) => (
                <SelectItem key={dur} value={String(dur)} className="text-xs">{dur}s</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!hasValidInput || data.isGenerating}
            size="icon-sm"
            className="h-8 w-8 min-w-8 bg-purple-500 hover:bg-purple-400 text-white rounded-full disabled:opacity-40 shrink-0"
          >
            {data.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Input Handles - Left side */}
      {/* Text Input - always shown except for first-last-frame which is image-only */}
      {inputMode !== 'first-last-frame' && (
        <div className="absolute -left-3 group" style={{ top: inputMode === 'text' ? '50%' : '30%', transform: 'translateY(-50%)' }}>
          <div className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id="text"
              className="!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !border-zinc-600 !rounded-md hover:!border-purple-500 hover:!bg-zinc-700"
            />
            <Type className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          </div>
          <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
            Text Prompt
          </span>
        </div>
      )}

      {/* Single Image Reference - for single-image mode */}
      {inputMode === 'single-image' && (
        <div className="absolute -left-3 group" style={{ top: '60%', transform: 'translateY(-50%)' }}>
          <div className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id="reference"
              className="!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !border-zinc-600 !rounded-md hover:!border-purple-500 hover:!bg-zinc-700"
            />
            <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          </div>
          <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
            Reference Image
          </span>
        </div>
      )}

      {/* First/Last Frame - for first-last-frame mode */}
      {inputMode === 'first-last-frame' && (
        <>
          <div className="absolute -left-3 group" style={{ top: '35%', transform: 'translateY(-50%)' }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="firstFrame"
                className={`!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !rounded-md hover:!border-purple-500 hover:!bg-zinc-700 ${
                  connectedInputs.firstFrameUrl ? '!border-green-500' : '!border-zinc-600'
                }`}
              />
              <ArrowRightFromLine className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
              First Frame
            </span>
          </div>
          <div className="absolute -left-3 group" style={{ top: '55%', transform: 'translateY(-50%)' }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="lastFrame"
                className={`!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !rounded-md hover:!border-purple-500 hover:!bg-zinc-700 ${
                  connectedInputs.lastFrameUrl ? '!border-green-500' : '!border-zinc-600'
                }`}
              />
              <ArrowLeftFromLine className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
              Last Frame
            </span>
          </div>
          {/* Text handle for prompt */}
          <div className="absolute -left-3 group" style={{ top: '75%', transform: 'translateY(-50%)' }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="text"
                className="!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !border-zinc-600 !rounded-md hover:!border-purple-500 hover:!bg-zinc-700"
              />
              <Type className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
              Text Prompt
            </span>
          </div>
        </>
      )}

      {/* Multi-Reference - for multi-reference mode */}
      {inputMode === 'multi-reference' && (
        <>
          {[1, 2, 3].map((num, idx) => (
            <div key={num} className="absolute -left-3 group" style={{ top: `${45 + idx * 15}%`, transform: 'translateY(-50%)' }}>
              <div className="relative">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`ref${num}`}
                  className={`!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !rounded-md hover:!border-purple-500 hover:!bg-zinc-700 ${
                    connectedInputs.referenceUrls?.[idx] ? '!border-green-500' : '!border-zinc-600'
                  }`}
                />
                <Images className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
              </div>
              <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
                Reference {num}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Output Handle - Right side */}
      <div className="absolute -right-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !border-zinc-600 !rounded-md hover:!border-green-500 hover:!bg-zinc-700"
          />
          <Video className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
        </div>
        <span className="absolute right-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
          Generated video
        </span>
      </div>
    </div>
  );
}

export const VideoGeneratorNode = memo(VideoGeneratorNodeComponent);
