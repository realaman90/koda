'use client';

import { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCanvasStore } from '@/stores/canvas-store';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
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
import { useBufferedNodeField } from './useBufferedNodeField';
import { useNodeDisplayMode } from './useNodeDisplayMode';
import { CanvasNodeShell } from '@/components/canvas/nodes/chrome/CanvasNodeShell';
import { NodeFloatingToolbar } from '@/components/canvas/nodes/chrome/NodeFloatingToolbar';
import { NodeFooterRail } from '@/components/canvas/nodes/chrome/NodeFooterRail';
import { NodeStagePrompt } from '@/components/canvas/nodes/chrome/NodeStagePrompt';
import { useNodeChromeState } from '@/components/canvas/nodes/chrome/useNodeChromeState';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';

type VoiceOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
};

const DEFAULT_VOICE_OPTIONS: VoiceOption[] = Object.entries(ELEVENLABS_VOICE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
    group: 'Built-in',
  })
);

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

function normalizeDialogueLines(value: unknown, fallbackVoice: string): DialogueLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => {
      if (!line || typeof line !== 'object') return null;
      const entry = line as Partial<DialogueLine>;
      const voice = typeof entry.voice === 'string' && entry.voice.trim() ? entry.voice : fallbackVoice;
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
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Speech');
  const [isHovered, setIsHovered] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const singleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const firstDialogueTextareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>(DEFAULT_VOICE_OPTIONS);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string>('');
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);
  const { displayMode, focusedWithin, focusProps } = useNodeDisplayMode(selected);
  const {
    draft: textDraft,
    handleChange: handleTextChange,
    handleBlur: handleTextBlur,
    commit: commitText,
  } = useBufferedNodeField({
    nodeId: id,
    value: data.text || '',
    field: 'text',
    preview: 'skip',
  });
  const selectedVoice = typeof data.voice === 'string' && data.voice.trim() ? data.voice : 'rachel';
  const mode = normalizeSpeechMode(data.mode);
  const dialogueLines = normalizeDialogueLines(data.dialogueLines, selectedVoice);
  const hydratedDialogueLines = dialogueLines.length > 0 ? dialogueLines : createDefaultDialogueLines();
  const dialogueSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedDialogueRef = useRef<Record<string, string>>(
    Object.fromEntries(hydratedDialogueLines.map((line) => [line.id, line.text]))
  );
  const [dialogueDrafts, setDialogueDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(hydratedDialogueLines.map((line) => [line.id, line.text]))
  );
  const dialogueDraftsRef = useRef(dialogueDrafts);
  dialogueDraftsRef.current = dialogueDrafts;
  const voiceLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of voiceOptions) {
      map.set(option.value, option.label);
    }
    for (const [key, label] of Object.entries(ELEVENLABS_VOICE_LABELS)) {
      if (!map.has(key)) map.set(key, label);
    }
    return map;
  }, [voiceOptions]);

  const getVoiceLabel = useCallback(
    (voice: string) => voiceLabelMap.get(voice) || voice,
    [voiceLabelMap]
  );

  const getVoiceShortLabel = useCallback(
    (voice: string) => getVoiceLabel(voice).split(' ')[0] || voice,
    [getVoiceLabel]
  );

  useEffect(() => {
    setDialogueDrafts((prev) => {
      let changed = Object.keys(prev).length !== hydratedDialogueLines.length;
      const next: Record<string, string> = {};

      for (const line of hydratedDialogueLines) {
        const lastSyncedValue = syncedDialogueRef.current[line.id];
        const prevValue = prev[line.id];
        next[line.id] = prevValue === undefined || prevValue === lastSyncedValue
          ? line.text
          : prevValue;

        if (next[line.id] !== prevValue) {
          changed = true;
        }
      }

      syncedDialogueRef.current = Object.fromEntries(
        hydratedDialogueLines.map((line) => [line.id, line.text])
      );

      return changed ? next : prev;
    });
  }, [hydratedDialogueLines]);

  useEffect(() => {
    return () => {
      if (dialogueSyncTimerRef.current) {
        clearTimeout(dialogueSyncTimerRef.current);
      }
    };
  }, []);

  const effectiveDialogueLines = useMemo(
    () => hydratedDialogueLines.map((line) => ({
      ...line,
      text: dialogueDrafts[line.id] ?? line.text,
    })),
    [dialogueDrafts, hydratedDialogueLines]
  );

  const persistDialogueLines = useCallback((lines: DialogueLine[], final: boolean) => {
    syncedDialogueRef.current = Object.fromEntries(lines.map((line) => [line.id, line.text]));
    updateNodeData(
      id,
      { dialogueLines: lines },
      final
        ? { history: 'push', save: 'schedule', preview: 'skip', kind: 'content' }
        : { history: 'skip', save: 'skip', preview: 'skip', kind: 'typing' }
    );
  }, [id, updateNodeData]);

  const commitDialogueDrafts = useCallback((final: boolean) => {
    if (dialogueSyncTimerRef.current) {
      clearTimeout(dialogueSyncTimerRef.current);
      dialogueSyncTimerRef.current = null;
    }

    const lines = hydratedDialogueLines.map((line) => ({
      ...line,
      text: dialogueDraftsRef.current[line.id] ?? line.text,
    }));

    persistDialogueLines(lines, final);
  }, [hydratedDialogueLines, persistDialogueLines]);

  const scheduleDialogueSync = useCallback(() => {
    if (dialogueSyncTimerRef.current) {
      clearTimeout(dialogueSyncTimerRef.current);
    }

    dialogueSyncTimerRef.current = setTimeout(() => {
      dialogueSyncTimerRef.current = null;
      commitDialogueDrafts(false);
    }, 750);
  }, [commitDialogueDrafts]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const loadVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const response = await fetch('/api/speech/voices', { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Failed to load voices');
        }

        const result = await response.json();
        if (isCancelled) return;

        const loaded: unknown[] = Array.isArray(result?.voices) ? result.voices : [];
        const normalized: VoiceOption[] = loaded
          .map((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return null;
            const candidate = entry as Partial<VoiceOption>;
            if (typeof candidate.value !== 'string' || !candidate.value.trim()) return null;
            if (typeof candidate.label !== 'string' || !candidate.label.trim()) return null;
            return {
              value: candidate.value,
              label: candidate.label,
              description: typeof candidate.description === 'string' ? candidate.description : undefined,
              group: typeof candidate.group === 'string' ? candidate.group : undefined,
            } as VoiceOption;
          })
          .filter((entry: VoiceOption | null): entry is VoiceOption => !!entry);

        if (normalized.length > 0) {
          setVoiceOptions(normalized);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError' && !isCancelled) {
          console.warn('Speech voice list fallback to defaults:', error);
        }
      } finally {
        if (!isCancelled) setIsLoadingVoices(false);
      }
    };

    void loadVoices();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, []);

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

  const handleModeChange = useCallback(
    (nextMode: SpeechMode) => {
      if (nextMode === mode) return;
      updateNodeData(id, {
        mode: nextMode,
        error: undefined,
        outputUrl: undefined,
        dialogueLines: nextMode === 'dialogue' ? effectiveDialogueLines : data.dialogueLines,
      });
    },
    [data.dialogueLines, effectiveDialogueLines, id, mode, updateNodeData]
  );

  const handleVoiceChange = useCallback(
    (value: string) => {
      updateNodeData(id, { voice: value as ElevenLabsVoice });
    },
    [id, updateNodeData]
  );

  const updateDialogueLine = useCallback(
    (lineId: string, patch: Partial<DialogueLine>) => {
      const updated = effectiveDialogueLines.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line
      );
      if (typeof patch.text === 'string') {
        setDialogueDrafts((prev) => ({ ...prev, [lineId]: patch.text as string }));
      }
      persistDialogueLines(updated, true);
    },
    [effectiveDialogueLines, persistDialogueLines]
  );

  const handleAddDialogueLine = useCallback(() => {
    const updated = [...effectiveDialogueLines, { id: makeLineId(), text: '', voice: selectedVoice }];
    setDialogueDrafts(Object.fromEntries(updated.map((line) => [line.id, line.text])));
    persistDialogueLines(updated, true);
  }, [effectiveDialogueLines, persistDialogueLines, selectedVoice]);

  const handleRemoveDialogueLine = useCallback(
    (lineId: string) => {
      if (effectiveDialogueLines.length <= 2) {
        toast.error('Dialogue needs at least 2 lines');
        return;
      }
      const updated = effectiveDialogueLines.filter((line) => line.id !== lineId);
      setDialogueDrafts(Object.fromEntries(updated.map((line) => [line.id, line.text])));
      persistDialogueLines(updated, true);
    },
    [effectiveDialogueLines, persistDialogueLines]
  );

  const handleDialogueTextChange = useCallback((lineId: string, value: string) => {
    setDialogueDrafts((prev) => ({ ...prev, [lineId]: value }));
    scheduleDialogueSync();
  }, [scheduleDialogueSync]);

  const handlePreviewVoice = useCallback(async (voice: string, sampleText?: string, key = voice) => {
    setPreviewingKey(key);
    try {
      const response = await fetch('/api/speech/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice,
          text: sampleText,
          speed: data.speed,
          stability: data.stability,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Voice preview failed');
      }

      const result = await response.json();
      const url = typeof result.audioUrl === 'string' ? result.audioUrl : '';
      if (!url) {
        throw new Error('No preview audio returned');
      }

      setPreviewAudioUrl(url);
      const audio = previewAudioRef.current;
      if (audio) {
        audio.src = url;
        await audio.play();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Voice preview failed';
      toast.error(errorMessage);
    } finally {
      setPreviewingKey((current) => (current === key ? null : current));
    }
  }, [data.speed, data.stability]);

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
    const connectedInputs = getConnectedInputs(id);
    let payload: Record<string, unknown>;

    if (mode === 'single') {
      await commitText(textDraft, true);
      let finalText = textDraft || '';
      if (connectedInputs.textContent) {
        finalText = connectedInputs.textContent + (textDraft ? `\n${textDraft}` : '');
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
      commitDialogueDrafts(true);
      const lines = effectiveDialogueLines.map((line) => ({ ...line, text: line.text.trim() }));
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
        const message = await getApiErrorMessage(response, 'Speech generation failed');
        throw new Error(message);
      }

      const result = await response.json();

      updateNodeData(id, {
        outputUrl: result.audioUrl,
        isGenerating: false,
      });

      toast.success('Speech generated successfully');
    } catch (error) {
      const errorMessage = normalizeApiErrorMessage(error, 'Speech generation failed');
      updateNodeData(id, {
        error: errorMessage,
        isGenerating: false,
      });
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [
    commitDialogueDrafts,
    commitText,
    id,
    data.speed,
    data.stability,
    effectiveDialogueLines,
    mode,
    selectedVoice,
    textDraft,
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
  const filledDialogueLines = effectiveDialogueLines.filter((line) => line.text.trim().length > 0);
  const hasValidInput = mode === 'single'
    ? !!(textDraft || connectedInputs.textContent)
    : connectedHasText
      ? filledDialogueLines.length >= 1
      : filledDialogueLines.length >= 2;
  const previewText = mode === 'single'
    ? textDraft
    : filledDialogueLines
        .slice(0, 2)
        .map((line) => `${getVoiceShortLabel(line.voice)}: ${line.text}`)
        .join(' / ');
  const promptPlaceholder = mode === 'single'
    ? (data.outputUrl ? 'Enter new text...' : 'Enter text to convert to speech...')
    : 'Add dialogue lines...';
  const chromeState = useNodeChromeState({
    isHovered,
    focusedWithin,
    isPromptFocused,
    selected,
    displayMode,
    hasOutput: !!data.outputUrl,
  });
  const showHandles = chromeState.showHandles;
  const isConnected = !!connectedInputs.textContent;
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
        title={data.outputUrl ? 'Regenerate speech' : 'Generate speech'}
      >
        {data.outputUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      {data.outputUrl ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={handleDownload}
          title="Download speech"
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
          <div className="inline-flex items-center rounded-xl bg-muted/80 p-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleModeChange('single')}
              className={`h-7 px-2.5 text-xs rounded-lg ${mode === 'single' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            >
              Single
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleModeChange('dialogue')}
              className={`h-7 px-2.5 text-xs rounded-lg ${mode === 'dialogue' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            >
              Dialogue
            </Button>
          </div>

          {mode === 'single' ? (
            <>
              <SearchableSelect
                value={selectedVoice}
                onValueChange={handleVoiceChange}
                options={voiceOptions}
                placeholder={isLoadingVoices ? 'Loading...' : 'Voice'}
                searchPlaceholder="Search voices..."
                triggerClassName="max-w-[132px] nodrag nopan"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handlePreviewVoice(selectedVoice, textDraft, 'single')}
                className="h-8 w-8 rounded-xl nodrag nopan text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                disabled={!!previewingKey}
                title="Preview voice"
              >
                {previewingKey === 'single' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          ) : (
            <span className="px-2 text-xs text-muted-foreground whitespace-nowrap">
              {filledDialogueLines.length} line{filledDialogueLines.length === 1 ? '' : 's'}
            </span>
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

  const promptOverlay = displayMode === 'summary' ? null : mode === 'single' ? (
    <NodeStagePrompt
      teaser={chromeState.showPromptTeaser ? (
        <p className={`node-prompt-teaser-clamp text-[15px] leading-6 ${previewText ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
          {previewText || promptPlaceholder}
        </p>
      ) : null}
      expanded={chromeState.showPromptEditor}
      onExpand={
        isReadOnly
          ? undefined
          : () => {
              setIsPromptExpanded(true);
              requestAnimationFrame(() => singleTextareaRef.current?.focus());
            }
      }
    >
      <div
        className="flex flex-col gap-3 nodrag nopan"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <textarea
          ref={singleTextareaRef}
          value={textDraft}
          onChange={handleTextChange}
          onFocus={() => {
            setIsPromptExpanded(true);
            setIsPromptFocused(true);
          }}
          onBlur={async () => {
            setIsPromptFocused(false);
            setIsPromptExpanded(false);
            await handleTextBlur();
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
        <p className={`node-prompt-teaser-clamp text-[15px] leading-6 ${previewText ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
          {previewText || promptPlaceholder}
        </p>
      ) : null}
      expanded={chromeState.showPromptEditor}
      onExpand={
        isReadOnly
          ? undefined
          : () => {
              setIsPromptExpanded(true);
              requestAnimationFrame(() => firstDialogueTextareaRef.current?.focus());
            }
      }
    >
      <div
        className="flex flex-col gap-2.5 nodrag nopan"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <audio ref={previewAudioRef} src={previewAudioUrl} className="hidden" />
        {effectiveDialogueLines.map((line, index) => {
          const linePreviewKey = `line:${line.id}`;
          const isPreviewingLine = previewingKey === linePreviewKey;
          return (
            <div key={line.id} className="rounded-xl border border-border/60 bg-muted/30 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-10 shrink-0">Line {index + 1}</span>
                <SearchableSelect
                  value={line.voice}
                  onValueChange={(value) => updateDialogueLine(line.id, { voice: value as ElevenLabsVoice })}
                  options={voiceOptions}
                  placeholder={isLoadingVoices ? 'Loading...' : 'Voice'}
                  searchPlaceholder="Search voices..."
                  className="flex-1"
                  triggerClassName="w-full max-w-none nodrag nopan"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handlePreviewVoice(line.voice, line.text, linePreviewKey)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 nodrag nopan"
                  disabled={!!previewingKey}
                  title="Preview this voice"
                >
                  {isPreviewingLine ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveDialogueLine(line.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50 nodrag nopan"
                  disabled={hydratedDialogueLines.length <= 2}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <textarea
                ref={index === 0 ? firstDialogueTextareaRef : undefined}
                value={line.text}
                onChange={(e) => handleDialogueTextChange(line.id, e.target.value)}
                onBlur={() => {
                  setIsPromptFocused(false);
                  setIsPromptExpanded(false);
                  commitDialogueDrafts(true);
                }}
                onFocus={() => {
                  setIsPromptFocused(true);
                  setIsPromptExpanded(true);
                }}
                placeholder="Speaker line..."
                className="node-stage-input nodrag nopan nowheel select-text w-full h-[64px] resize-none border-0 bg-transparent px-0 py-0 focus:outline-none text-sm"
                style={{
                  colorScheme: 'dark',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  caretColor: 'var(--text-primary)',
                }}
              />
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddDialogueLine}
          className="h-7 px-2 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 nodrag nopan"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add line
        </Button>
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
                setNodeName(data.name || 'Speech');
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
            {data.name || 'Speech'}
          </span>
        )}
        icon={<Mic className="h-4 w-4" />}
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
                Generating speech...
              </p>
              <p className="text-muted-foreground text-xs mt-1">This may take a moment</p>
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
                  <Volume2 className="h-4 w-4 text-primary/80" />
                  <span className="text-sm text-foreground font-medium">
                    {mode === 'dialogue'
                      ? `Dialogue mix (${filledDialogueLines.length} lines)`
                      : getVoiceLabel(selectedVoice)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === 'dialogue' ? `Stability: ${data.stability.toFixed(1)}` : `Speed: ${data.speed}x`}
                </p>
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
          Text Input
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
          <Mic className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Generated speech
        </span>
      </div>
    </div>
  );
}

export const SpeechNode = memo(SpeechNodeComponent);
