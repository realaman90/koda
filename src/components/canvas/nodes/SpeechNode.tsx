'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { useCanvasStore } from '@/stores/canvas-store';
import type { SpeechNode as SpeechNodeType, ElevenLabsVoice } from '@/lib/types';
import { ELEVENLABS_VOICE_LABELS } from '@/lib/types';
import {
  Mic,
  Play,
  Pause,
  Trash2,
  Download,
  Loader2,
  Type,
  RefreshCw,
  Settings,
  Volume2,
  Plus,
} from 'lucide-react';

const VOICE_OPTIONS = Object.entries(ELEVENLABS_VOICE_LABELS) as [ElevenLabsVoice, string][];
type SpeechMode = 'single' | 'dialogue';
type DialogueLine = { id: string; text: string; voice: ElevenLabsVoice };

function makeLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSpeechMode(mode: unknown): SpeechMode {
  return mode === 'dialogue' ? 'dialogue' : 'single';
}

function normalizeDialogueLines(value: unknown, fallbackVoice: ElevenLabsVoice): DialogueLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => {
      if (!line || typeof line !== 'object') return null;
      const entry = line as Partial<DialogueLine>;
      const voice = (entry.voice && ELEVENLABS_VOICE_LABELS[entry.voice]) ? entry.voice : fallbackVoice;
      return {
        id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : makeLineId(),
        text: typeof entry.text === 'string' ? entry.text : '',
        voice,
      } as DialogueLine;
    })
    .filter((line): line is DialogueLine => !!line);
}

function createDefaultDialogueLines(): DialogueLine[] {
  return [
    { id: makeLineId(), voice: 'rachel', text: '' },
    { id: makeLineId(), voice: 'drew', text: '' },
  ];
}

function SpeechNodeComponent({ id, data, selected }: NodeProps<SpeechNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Speech');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const selectedVoice = (data.voice && ELEVENLABS_VOICE_LABELS[data.voice]) ? data.voice : 'rachel';
  const mode = normalizeSpeechMode(data.mode);
  const dialogueLines = normalizeDialogueLines(data.dialogueLines, selectedVoice);
  const hydratedDialogueLines = dialogueLines.length > 0 ? dialogueLines : createDefaultDialogueLines();

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

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleModeChange = useCallback(
    (nextMode: SpeechMode) => {
      if (nextMode === mode) return;
      updateNodeData(id, {
        mode: nextMode,
        error: undefined,
        outputUrl: undefined,
        dialogueLines: nextMode === 'dialogue' ? hydratedDialogueLines : data.dialogueLines,
      });
    },
    [id, mode, updateNodeData, hydratedDialogueLines, data.dialogueLines]
  );

  const handleVoiceChange = useCallback(
    (value: string) => {
      updateNodeData(id, { voice: value as ElevenLabsVoice });
    },
    [id, updateNodeData]
  );

  const handleSpeedChange = useCallback(
    (value: number[]) => {
      updateNodeData(id, { speed: value[0] });
    },
    [id, updateNodeData]
  );

  const handleStabilityChange = useCallback(
    (value: number[]) => {
      updateNodeData(id, { stability: value[0] });
    },
    [id, updateNodeData]
  );

  const updateDialogueLine = useCallback(
    (lineId: string, patch: Partial<DialogueLine>) => {
      const updated = hydratedDialogueLines.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line
      );
      updateNodeData(id, { dialogueLines: updated });
    },
    [id, updateNodeData, hydratedDialogueLines]
  );

  const handleAddDialogueLine = useCallback(() => {
    const updated = [...hydratedDialogueLines, { id: makeLineId(), text: '', voice: selectedVoice }];
    updateNodeData(id, { dialogueLines: updated });
  }, [id, updateNodeData, hydratedDialogueLines, selectedVoice]);

  const handleRemoveDialogueLine = useCallback(
    (lineId: string) => {
      if (hydratedDialogueLines.length <= 2) {
        toast.error('Dialogue needs at least 2 lines');
        return;
      }
      const updated = hydratedDialogueLines.filter((line) => line.id !== lineId);
      updateNodeData(id, { dialogueLines: updated });
    },
    [id, updateNodeData, hydratedDialogueLines]
  );

  const handleGenerate = useCallback(async () => {
    const connectedInputs = getConnectedInputs(id);
    let payload: Record<string, unknown>;

    if (mode === 'single') {
      let finalText = data.text || '';
      if (connectedInputs.textContent) {
        finalText = connectedInputs.textContent + (data.text ? `\n${data.text}` : '');
      }
      if (!finalText.trim()) {
        toast.error('Please enter text or connect a text node');
        return;
      }
      payload = {
        mode: 'single',
        text: finalText.trim(),
        voice: selectedVoice,
        speed: data.speed,
        stability: data.stability,
      };
    } else {
      const lines = hydratedDialogueLines.map((line) => ({ ...line, text: line.text.trim() }));
      const connectedText = connectedInputs.textContent?.trim();
      if (connectedText) {
        const first = lines[0] || { id: makeLineId(), text: '', voice: selectedVoice };
        first.text = first.text ? `${connectedText}\n${first.text}` : connectedText;
        if (lines.length === 0) lines.push(first);
      }
      const filledLines = lines.filter((line) => line.text.length > 0);
      if (filledLines.length < 2) {
        toast.error('Add at least 2 dialogue lines');
        return;
      }
      payload = {
        mode: 'dialogue',
        stability: data.stability,
        dialogueLines: filledLines.map((line) => ({ text: line.text, voice: line.voice })),
      };
    }

    updateNodeData(id, { isGenerating: true, error: undefined });

    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Speech generation failed');
      }

      const result = await response.json();

      updateNodeData(id, {
        outputUrl: result.audioUrl,
        isGenerating: false,
      });

      toast.success('Speech generated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Speech generation failed';
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [
    id,
    data.text,
    data.speed,
    data.stability,
    mode,
    selectedVoice,
    hydratedDialogueLines,
    updateNodeData,
    getConnectedInputs,
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
      a.download = `speech-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Speech downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download speech');
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
  const connectedHasText = !!connectedInputs.textContent?.trim();
  const filledDialogueLines = hydratedDialogueLines.filter((line) => line.text.trim().length > 0);
  const hasValidInput = mode === 'single'
    ? !!(data.text || connectedInputs.textContent)
    : connectedHasText
      ? filledDialogueLines.length >= 1
      : filledDialogueLines.length >= 2;
  const previewText = mode === 'single'
    ? data.text
    : filledDialogueLines
        .slice(0, 2)
        .map((line) => `${ELEVENLABS_VOICE_LABELS[line.voice]?.split(' ')[0] || line.voice}: ${line.text}`)
        .join(' / ');

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur rounded-lg px-2 py-1.5 border shadow-xl z-10 node-toolbar-floating">
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
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-speech)' }}>
        <Mic className="h-4 w-4" />
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
                setNodeName(data.name || 'Speech');
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
            {data.name || 'Speech'}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[320px] rounded-2xl overflow-hidden
          transition-[box-shadow,ring-color] duration-150
          ${data.isGenerating
            ? 'ring-[2.5px] ring-cyan-500 shadow-lg shadow-cyan-500/20 animate-pulse-glow'
            : selected
              ? 'ring-[2.5px] ring-cyan-500 shadow-lg shadow-cyan-500/10'
              : 'ring-1 ring-border hover:ring-muted-foreground/30'
          }
        `}
        style={{ backgroundColor: 'var(--node-card-bg)' }}
      >
        {/* Content Area */}
        <div className="relative">
          {/* Loading State */}
          {data.isGenerating ? (
            <div className="p-4 min-h-[200px] flex flex-col items-center justify-center gap-4">
              {previewText && (
                <p className="text-muted-foreground text-xs text-center line-clamp-2 max-w-[90%]">
                  {previewText}
                </p>
              )}
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
                  Generating speech...
                </p>
                <p className="text-muted-foreground text-xs mt-1">This may take a moment</p>
              </div>
            </div>
          ) : data.outputUrl ? (
            /* Audio Player */
            <div className="p-4 space-y-3">
              <audio ref={audioRef} src={data.outputUrl} className="hidden" />
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePlayPause}
                  className="h-10 w-10 bg-cyan-500 hover:bg-cyan-400 text-white rounded-full"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-foreground font-medium">
                      {mode === 'dialogue'
                        ? `Dialogue mix (${filledDialogueLines.length} lines)`
                        : ELEVENLABS_VOICE_LABELS[selectedVoice]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mode === 'dialogue' ? `Stability: ${data.stability.toFixed(1)}` : `Speed: ${data.speed}x`}
                  </p>
                </div>
              </div>
              {/* Show text below player */}
              {previewText ? (
                <p className="text-xs text-muted-foreground line-clamp-2">{previewText}</p>
              ) : null}
            </div>
          ) : mode === 'single' ? (
            /* Single Text Input */
            <div className="p-4 min-h-[140px]">
              <textarea
                value={data.text}
                onChange={handleTextChange}
                placeholder="Enter the text to convert to speech..."
                className="w-full h-[100px] bg-transparent border-none text-sm resize-none focus:outline-none node-input"
                style={{ color: 'var(--text-secondary)' }}
              />
            </div>
          ) : (
            /* Dialogue Input */
            <div className="p-4 min-h-[180px] space-y-2.5">
              {hydratedDialogueLines.map((line, index) => (
                <div key={line.id} className="rounded-xl border border-border/60 bg-muted/30 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-10 shrink-0">Line {index + 1}</span>
                    <Select
                      value={line.voice}
                      onValueChange={(value) => updateDialogueLine(line.id, { voice: value as ElevenLabsVoice })}
                    >
                      <SelectTrigger className="h-7 flex-1 bg-muted/80 border-0 text-xs text-foreground px-2 rounded-md hover:bg-muted">
                        <SelectValue>
                          {ELEVENLABS_VOICE_LABELS[line.voice]?.split(' ')[0] || line.voice}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-[250px]">
                        {VOICE_OPTIONS.map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveDialogueLine(line.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
                      disabled={hydratedDialogueLines.length <= 2}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <textarea
                    value={line.text}
                    onChange={(e) => updateDialogueLine(line.id, { text: e.target.value })}
                    placeholder="Speaker line..."
                    className="w-full h-[64px] bg-transparent border-none text-sm resize-none focus:outline-none node-input"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddDialogueLine}
                className="h-7 px-2 text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add line
              </Button>
            </div>
          )}

          {/* Error Display */}
          {data.error && (
            <p className="text-xs text-red-400 px-4 pb-2">{data.error}</p>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-4 py-3 border-t border-border space-y-3">
            {mode === 'single' && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Speed: {data.speed.toFixed(1)}x</label>
                <Slider
                  value={[data.speed]}
                  onValueChange={handleSpeedChange}
                  min={0.7}
                  max={1.2}
                  step={0.1}
                  className="w-full"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Stability: {data.stability.toFixed(1)}
                {mode === 'dialogue' ? ' (0.0 / 0.5 / 1.0)' : ''}
              </label>
              <Slider
                value={[data.stability]}
                onValueChange={handleStabilityChange}
                min={0}
                max={1}
                step={mode === 'dialogue' ? 0.5 : 0.1}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Bottom Toolbar */}
        <div className="flex items-center flex-wrap gap-1.5 px-3 py-2.5 node-bottom-toolbar">
          {/* Mode Toggle */}
          <div className="inline-flex items-center rounded-md bg-muted/80 p-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleModeChange('single')}
              className={`h-6 px-2 text-xs ${mode === 'single' ? 'bg-cyan-500/20 text-cyan-300' : 'text-muted-foreground'}`}
            >
              Single
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleModeChange('dialogue')}
              className={`h-6 px-2 text-xs ${mode === 'dialogue' ? 'bg-cyan-500/20 text-cyan-300' : 'text-muted-foreground'}`}
            >
              Dialogue
            </Button>
          </div>

          {/* Voice Selector (single mode only) */}
          {mode === 'single' && (
            <Select value={selectedVoice} onValueChange={handleVoiceChange}>
              <SelectTrigger className="h-7 max-w-[130px] bg-muted/80 border-0 text-xs text-foreground gap-1 px-2 rounded-md hover:bg-muted">
                <SelectValue>
                  {ELEVENLABS_VOICE_LABELS[selectedVoice]?.split(' ')[0] || selectedVoice}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[250px]">
                {VOICE_OPTIONS.map(([key, label]) => (
                  <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Settings Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`h-7 w-7 shrink-0 ${
              showSettings
                ? 'text-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
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
            className="h-8 w-8 min-w-8 bg-cyan-500 hover:bg-cyan-400 text-white rounded-full disabled:opacity-40 shrink-0"
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
      </div>

      {/* Input Handle - Text */}
      <div className="absolute -left-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="text"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Text Input
        </span>
      </div>

      {/* Output Handle - Audio */}
      <div className="absolute -right-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Mic className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated speech
        </span>
      </div>
    </div>
  );
}

export const SpeechNode = memo(SpeechNodeComponent);
