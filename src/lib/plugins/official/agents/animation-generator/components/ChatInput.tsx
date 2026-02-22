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
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AnimationEngine } from '../types';

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
  /** Compact summary values for the settings bar */
  engine?: AnimationEngine;
  aspectRatio?: string;
  duration?: number;
  techniques?: string[];
  /** Open the settings panel */
  onOpenSettings?: () => void;
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
  aspectRatio = '16:9',
  duration = 5,
  techniques = [],
  onOpenSettings,
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

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-2 py-1 pb-2">
          {/* Settings summary — click to open panel (hidden when no callback) */}
          {onOpenSettings ? (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] text-[var(--an-text-placeholder)] hover:text-[var(--an-text-muted)] transition-colors"
              disabled={disabled}
            >
              <Settings className="w-3 h-3" />
              <span>
                {engine === 'remotion' ? 'Remotion' : 'Theatre'} · {aspectRatio} · {duration}s
                {techniques.length > 0 ? ` · ${techniques.length} preset${techniques.length > 1 ? 's' : ''}` : ''}
              </span>
            </button>
          ) : (
            <div />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Paperclip / Attach (hidden when no media callbacks) */}
            {(onMediaUpload || onNodeReference) && (
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
            )}

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
