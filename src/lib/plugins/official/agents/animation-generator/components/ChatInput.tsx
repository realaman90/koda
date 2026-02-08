'use client';

/**
 * ChatInput Component
 *
 * Rich chat input with queue support for messages while agent is busy.
 * Design matches the reference with collapsible queue section.
 */

import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import {
  ArrowUp, Square, Paperclip, ChevronDown, ChevronUp, Image, Video, Link2, Pencil, Trash2,
  Type, Sparkles, Box, BarChart3, Layers, Blend, Zap, Clapperboard, Aperture, SunMoon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AnimationEngine } from '../types';
import { TECHNIQUE_PRESETS } from '@/mastra/recipes';

/** Map Lucide icon name strings to components for technique chips */
const TECHNIQUE_ICONS: Record<string, LucideIcon> = {
  Type, Sparkles, Box, BarChart3, Layers, Blend, Zap, Clapperboard, Aperture, SunMoon,
};

const ENGINES: { id: AnimationEngine; label: string }[] = [
  { id: 'remotion', label: 'Remotion' },
  { id: 'theatre', label: 'Theatre.js' },
];

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
  { id: '21:9', label: '21:9' },
];

const DURATIONS: { value: number; label: string }[] = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
];

interface QueuedMessage {
  id: string;
  text: string;
}

interface ChatInputProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  /** Tool calls are still running (more fine-grained than isGenerating) */
  hasActiveTool?: boolean;
  disabled?: boolean;
  placeholder?: string;
  engine?: AnimationEngine;
  onEngineChange?: (engine: AnimationEngine) => void;
  /** Lock the engine dropdown (e.g. after first message is sent) */
  engineLocked?: boolean;
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (aspectRatio: AspectRatio) => void;
  duration?: number;
  onDurationChange?: (duration: number) => void;
  /** Selected technique presets */
  techniques?: string[];
  onTechniquesChange?: (techniques: string[]) => void;
  /** Upload files to data.media[] */
  onMediaUpload?: (files: FileList) => void;
  /** Reference a canvas node output → data.media[] */
  onNodeReference?: (node: { nodeId: string; name: string; type: 'image' | 'video'; url: string }) => void;
  availableNodeOutputs?: Array<{ nodeId: string; name: string; type: 'image' | 'video'; url: string }>;
}

export function ChatInput({
  onSubmit,
  onStop,
  isGenerating,
  hasActiveTool,
  disabled,
  placeholder = 'Describe the animation you want...',
  engine = 'remotion',
  onEngineChange,
  engineLocked = false,
  aspectRatio = '16:9',
  onAspectRatioChange,
  duration = 10,
  onDurationChange,
  techniques = [],
  onTechniquesChange,
  onMediaUpload,
  onNodeReference,
  availableNodeOutputs = [],
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [queueExpanded, setQueueExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTechniques, setShowTechniques] = useState(techniques.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const toggleTechnique = useCallback((id: string) => {
    const next = techniques.includes(id)
      ? techniques.filter(t => t !== id)
      : [...techniques, id];
    onTechniquesChange?.(next);
  }, [techniques, onTechniquesChange]);

  const selectedEngine = ENGINES.find((e) => e.id === engine) || ENGINES[0];
  const selectedAspectRatio = ASPECT_RATIOS.find((a) => a.id === aspectRatio) || ASPECT_RATIOS[0];
  const selectedDuration = DURATIONS.find((d) => d.value === duration) || DURATIONS[1];

  // Show busy state if streaming OR if tool is active
  const isBusy = isGenerating || hasActiveTool;

  // Dynamic placeholder
  const inputPlaceholder = queue.length > 0 ? 'Add a follow-up...' : placeholder;

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    if (isBusy) {
      // Queue the message
      setQueue((prev) => [...prev, { id: `q_${Date.now()}`, text: trimmed }]);
      setMessage('');
    } else {
      // Send immediately
      onSubmit(trimmed);
      setMessage('');
    }
  }, [message, isBusy, disabled, onSubmit]);

  const handleSendQueued = useCallback(
    (item: QueuedMessage) => {
      if (onStop) {
        onStop();
        // Small delay to ensure stream is aborted
        setTimeout(() => {
          onSubmit(item.text);
          setQueue((prev) => prev.filter((q) => q.id !== item.id));
        }, 100);
      }
    },
    [onStop, onSubmit]
  );

  const handleDeleteQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditText('');
    }
  }, [editingId]);

  const handleStartEdit = useCallback((item: QueuedMessage) => {
    setEditingId(item.id);
    setEditText(item.text);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed) {
      setQueue((prev) =>
        prev.map((q) => (q.id === editingId ? { ...q, text: trimmed } : q))
      );
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleStop = useCallback(() => {
    if (onStop) onStop();
  }, [onStop]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  const handleFileSelect = useCallback((type: 'image' | 'video') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      onMediaUpload?.(files);
      e.target.value = '';
    },
    [onMediaUpload]
  );

  const handleNodeRef = useCallback(
    (node: { nodeId: string; name: string; type: 'image' | 'video'; url: string }) => {
      onNodeReference?.(node);
      setShowAttachMenu(false);
    },
    [onNodeReference]
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [message]);

  const canSend = !disabled && message.trim().length > 0;

  return (
    <div className="px-3 pt-2 pb-2.5 border-t border-[var(--an-border)]">
      {/* Queued messages section */}
      {queue.length > 0 && (
        <div className="mb-2 rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={() => setQueueExpanded(!queueExpanded)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-[12px] text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] transition-colors"
          >
            {queueExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
            <span>{queue.length} Queued</span>
          </button>

          {/* Queue items */}
          {queueExpanded && (
            <div className="px-3 pb-2 space-y-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 group"
                >
                  {/* Circle indicator */}
                  <div className="w-4 h-4 rounded-full border border-[var(--an-border-hover)] shrink-0" />

                  {/* Message text or edit input */}
                  {editingId === item.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveEdit}
                      className="flex-1 bg-[var(--an-bg-input)] border border-[var(--an-border-input)] rounded px-2 py-1 text-[12px] text-[var(--an-text)] outline-none focus:border-[var(--an-border-hover)]"
                    />
                  ) : (
                    <span className="flex-1 text-[12px] text-[var(--an-text-muted)] truncate">
                      {item.text}
                    </span>
                  )}

                  {/* Action buttons */}
                  {editingId !== item.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1 text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSendQueued(item)}
                        className="p-1 text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)] transition-colors"
                        title="Stop current and send this"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQueued(item.id)}
                        className="p-1 text-[var(--an-text-placeholder)] hover:text-[#EF4444] transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input box */}
      <div className="rounded-[10px] border border-[var(--an-border-input)] overflow-hidden" style={{ backgroundColor: 'var(--an-bg-card)' }}>
        {/* Textarea area */}
        <div className="px-3 pt-2.5 pb-1.5">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none text-[13px] text-[var(--an-text)] outline-none leading-[1.4]"
            style={{ minHeight: '20px', maxHeight: '100px', backgroundColor: 'transparent' }}
          />
        </div>

        {/* Technique preset chips — horizontal scrollable strip */}
        {showTechniques && (
          <div className="px-2.5 pb-1.5">
            <div
              className="flex gap-1 overflow-x-auto scrollbar-hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
              onWheel={(e) => e.stopPropagation()}
            >
              {TECHNIQUE_PRESETS.map((preset) => {
                const isSelected = techniques.includes(preset.id);
                const IconComponent = TECHNIQUE_ICONS[preset.icon];
                return (
                  <button
                    key={preset.id}
                    onClick={() => toggleTechnique(preset.id)}
                    disabled={disabled}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-[var(--an-accent-bg)] border-[var(--an-accent)] text-[var(--an-accent-text)]'
                        : 'bg-transparent border-[var(--an-border-input)] text-[var(--an-text-dim)] hover:border-[var(--an-border-hover)] hover:text-[var(--an-text-muted)]'
                    }`}
                    title={preset.description}
                  >
                    {IconComponent && <IconComponent className="w-3 h-3" />}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-2 py-1 pb-2">
          {/* Settings selectors */}
          <div className="flex items-center gap-0.5">
            {/* Techniques toggle */}
            <button
              onClick={() => setShowTechniques(v => !v)}
              disabled={disabled}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${
                techniques.length > 0
                  ? 'text-[var(--an-accent-text)]'
                  : 'text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)]'
              }`}
              title="Technique presets"
            >
              <Sparkles className="w-3 h-3" />
              {techniques.length > 0 && <span>{techniques.length}</span>}
            </button>

            <span className="text-[var(--an-border)] text-[10px]">/</span>

            {/* Engine selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-0.5 px-1 py-1 rounded text-[10px] transition-colors ${engineLocked ? 'text-[var(--an-border-input)] cursor-default' : 'text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)]'}`}
                  disabled={disabled || engineLocked}
                >
                  {selectedEngine.label}
                  {!engineLocked && <ChevronDown className="w-2.5 h-2.5" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel className="text-xs text-zinc-500">Animation Engine</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ENGINES.map((e) => (
                  <DropdownMenuItem
                    key={e.id}
                    onSelect={() => onEngineChange?.(e.id)}
                    className={engine === e.id ? 'bg-[var(--an-bg-card)]' : ''}
                  >
                    <span className="text-sm">{e.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-[var(--an-border)] text-[10px]">/</span>

            {/* Aspect Ratio selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-0.5 px-1 py-1 rounded text-[10px] text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)] transition-colors"
                  disabled={disabled}
                >
                  {selectedAspectRatio.label}
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuLabel className="text-xs text-zinc-500">Aspect Ratio</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ASPECT_RATIOS.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onSelect={() => onAspectRatioChange?.(a.id)}
                    className={aspectRatio === a.id ? 'bg-[var(--an-bg-card)]' : ''}
                  >
                    <span className="text-sm">{a.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-[var(--an-border)] text-[10px]">/</span>

            {/* Duration selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-0.5 px-1 py-1 rounded text-[10px] text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)] transition-colors"
                  disabled={disabled}
                >
                  {selectedDuration.label}
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuLabel className="text-xs text-zinc-500">Duration</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DURATIONS.map((d) => (
                  <DropdownMenuItem
                    key={d.value}
                    onSelect={() => onDurationChange?.(d.value)}
                    className={duration === d.value ? 'bg-[var(--an-bg-card)]' : ''}
                  >
                    <span className="text-sm">{d.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Paperclip / Attach */}
            <DropdownMenu open={showAttachMenu} onOpenChange={setShowAttachMenu}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--an-text-placeholder)] hover:text-[var(--an-text-dim)] transition-colors"
                  disabled={disabled}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-zinc-500">Add Reference</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleFileSelect('image')}>
                  <Image className="h-4 w-4 mr-2 text-teal-400" />
                  Upload Image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFileSelect('video')}>
                  <Video className="h-4 w-4 mr-2 text-purple-400" />
                  Upload Video
                </DropdownMenuItem>
                {availableNodeOutputs.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-zinc-500">From Canvas</DropdownMenuLabel>
                    {availableNodeOutputs.map((node) => (
                      <DropdownMenuItem key={node.nodeId} onClick={() => handleNodeRef(node)}>
                        {node.type === 'image' ? (
                          <Image className="h-4 w-4 mr-2 text-teal-400" />
                        ) : (
                          <Video className="h-4 w-4 mr-2 text-purple-400" />
                        )}
                        <span className="truncate">{node.name}</span>
                        <Link2 className="h-3 w-3 ml-auto text-zinc-500" />
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Stop button (when busy) */}
            {isBusy && (
              <button
                onClick={handleStop}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--an-bg-hover)] hover:bg-[var(--an-border-hover)] transition-colors"
                title="Stop generation"
              >
                <Square className="w-3 h-3 text-white" />
              </button>
            )}

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                canSend
                  ? 'bg-[var(--an-accent)] hover:bg-[var(--an-accent-hover)]'
                  : 'bg-[var(--an-accent)] opacity-40 cursor-not-allowed'
              }`}
              title={isBusy ? 'Queue message' : 'Send message'}
            >
              <ArrowUp className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
