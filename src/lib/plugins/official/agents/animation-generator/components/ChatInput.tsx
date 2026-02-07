'use client';

/**
 * ChatInput Component
 *
 * Rich chat input with queue support for messages while agent is busy.
 * Design matches the reference with collapsible queue section.
 */

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { ArrowUp, Square, Paperclip, ChevronDown, ChevronUp, Image, Video, Link2, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AnimationEngine } from '../types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
    <div className="px-3 pt-2 pb-2.5 border-t border-[#27272a]">
      {/* Queued messages section */}
      {queue.length > 0 && (
        <div className="mb-2 rounded-lg bg-[#1e1e20] border border-[#3f3f46] overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={() => setQueueExpanded(!queueExpanded)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#71717A] hover:text-[#A1A1AA] transition-colors"
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
                  <div className="w-4 h-4 rounded-full border border-[#52525B] shrink-0" />

                  {/* Message text or edit input */}
                  {editingId === item.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveEdit}
                      className="flex-1 bg-[#27272a] border border-[#3f3f46] rounded px-2 py-1 text-[12px] text-[#FAFAFA] outline-none focus:border-[#52525B]"
                    />
                  ) : (
                    <span className="flex-1 text-[12px] text-[#A1A1AA] truncate">
                      {item.text}
                    </span>
                  )}

                  {/* Action buttons */}
                  {editingId !== item.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSendQueued(item)}
                        className="p-1 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                        title="Stop current and send this"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQueued(item.id)}
                        className="p-1 text-[#52525B] hover:text-[#EF4444] transition-colors"
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
      <div className="rounded-[10px] bg-[#27272a] border border-[#3f3f46] overflow-hidden">
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
            className="w-full resize-none bg-transparent text-[13px] text-[#FAFAFA] placeholder:text-[#52525B] outline-none leading-[1.4]"
            style={{ minHeight: '20px', maxHeight: '100px' }}
          />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-2 py-1 pb-2">
          {/* Engine & Aspect Ratio selectors */}
          <div className="flex items-center gap-1">
            {/* Engine selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] transition-colors ${engineLocked ? 'text-[#52525B] cursor-default' : 'text-[#71717A] hover:text-[#A1A1AA]'}`}
                  disabled={disabled || engineLocked}
                >
                  {selectedEngine.label}
                  {!engineLocked && <ChevronDown className="w-2.5 h-2.5 text-[#52525B]" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel className="text-xs text-zinc-500">Animation Engine</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ENGINES.map((e) => (
                  <DropdownMenuItem
                    key={e.id}
                    onSelect={() => onEngineChange?.(e.id)}
                    className={engine === e.id ? 'bg-zinc-800' : ''}
                  >
                    <span className="text-sm">{e.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <span className="text-[#3f3f46]">•</span>

            {/* Aspect Ratio selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[#71717A] hover:text-[#A1A1AA] transition-colors"
                  disabled={disabled}
                >
                  {selectedAspectRatio.label}
                  <ChevronDown className="w-2.5 h-2.5 text-[#52525B]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuLabel className="text-xs text-zinc-500">Aspect Ratio</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ASPECT_RATIOS.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onSelect={() => onAspectRatioChange?.(a.id)}
                    className={aspectRatio === a.id ? 'bg-zinc-800' : ''}
                  >
                    <span className="text-sm">{a.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <span className="text-[#3f3f46]">•</span>

            {/* Duration selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[#71717A] hover:text-[#A1A1AA] transition-colors"
                  disabled={disabled}
                >
                  {selectedDuration.label}
                  <ChevronDown className="w-2.5 h-2.5 text-[#52525B]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuLabel className="text-xs text-zinc-500">Duration</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DURATIONS.map((d) => (
                  <DropdownMenuItem
                    key={d.value}
                    onSelect={() => onDurationChange?.(d.value)}
                    className={duration === d.value ? 'bg-zinc-800' : ''}
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
                  className="flex items-center justify-center w-7 h-7 rounded-md text-[#52525B] hover:text-[#71717A] transition-colors"
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
                className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors"
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
                  ? 'bg-[#3B82F6] hover:bg-[#2563EB]'
                  : 'bg-[#3B82F6] opacity-40 cursor-not-allowed'
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
