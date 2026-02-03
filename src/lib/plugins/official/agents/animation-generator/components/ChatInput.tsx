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
import type { AnimationAttachment } from '../types';

const MODELS = [
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-haiku-3-5', label: 'Claude Haiku 3.5' },
  { id: 'anthropic/claude-opus-4', label: 'Claude Opus 4' },
] as const;

interface QueuedMessage {
  id: string;
  text: string;
}

interface ChatInputProps {
  onSubmit: (message: string, attachments?: AnimationAttachment[]) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  /** Tool calls are still running (more fine-grained than isGenerating) */
  hasActiveTool?: boolean;
  disabled?: boolean;
  placeholder?: string;
  model?: string;
  onModelChange?: (model: string) => void;
  attachments?: AnimationAttachment[];
  onAttachmentsChange?: (attachments: AnimationAttachment[]) => void;
  availableNodeOutputs?: Array<{ nodeId: string; name: string; type: 'image' | 'video'; url: string }>;
}

export function ChatInput({
  onSubmit,
  onStop,
  isGenerating,
  hasActiveTool,
  disabled,
  placeholder = 'Describe the animation you want...',
  model = 'anthropic/claude-sonnet-4-5',
  onModelChange,
  attachments = [],
  onAttachmentsChange,
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

  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

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
      onSubmit(trimmed, attachments.length > 0 ? attachments : undefined);
      setMessage('');
    }
  }, [message, isBusy, disabled, onSubmit, attachments]);

  const handleSendQueued = useCallback(
    (item: QueuedMessage) => {
      if (onStop) {
        onStop();
        // Small delay to ensure stream is aborted
        setTimeout(() => {
          onSubmit(item.text, attachments.length > 0 ? attachments : undefined);
          setQueue((prev) => prev.filter((q) => q.id !== item.id));
        }, 100);
      }
    },
    [onStop, onSubmit, attachments]
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
      const file = files[0];
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      const newAttachment: AnimationAttachment = {
        id: `attach_${Date.now()}`,
        type: isVideo ? 'video' : 'image',
        url,
        name: file.name,
      };
      onAttachmentsChange?.([...attachments, newAttachment]);
      e.target.value = '';
    },
    [attachments, onAttachmentsChange]
  );

  const handleNodeReference = useCallback(
    (node: { nodeId: string; name: string; type: 'image' | 'video'; url: string }) => {
      const newAttachment: AnimationAttachment = {
        id: `noderef_${node.nodeId}_${Date.now()}`,
        type: node.type,
        url: node.url,
        name: node.name,
        nodeId: node.nodeId,
      };
      onAttachmentsChange?.([...attachments, newAttachment]);
      setShowAttachMenu(false);
    },
    [attachments, onAttachmentsChange]
  );

  const handleRemoveAttachment = useCallback(
    (attachmentId: string) => {
      const removed = attachments.find((a) => a.id === attachmentId);
      if (removed && !removed.nodeId && removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url);
      }
      onAttachmentsChange?.(attachments.filter((a) => a.id !== attachmentId));
    },
    [attachments, onAttachmentsChange]
  );

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (!a.nodeId && a.url.startsWith('blob:')) {
          URL.revokeObjectURL(a.url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#27272a] border border-[#3f3f46] text-[10px]"
            >
              {attachment.type === 'image' ? (
                <Image className="h-2.5 w-2.5 text-teal-400" />
              ) : (
                <Video className="h-2.5 w-2.5 text-purple-400" />
              )}
              <span className="text-[#A1A1AA] max-w-[80px] truncate">
                {attachment.name || (attachment.nodeId ? 'Node output' : 'File')}
              </span>
              {attachment.nodeId && <Link2 className="h-2.5 w-2.5 text-[#52525B]" />}
              <button
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="text-[#52525B] hover:text-[#EF4444] transition-colors ml-0.5"
              >
                &times;
              </button>
            </div>
          ))}
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
          {/* Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[#71717A] hover:text-[#A1A1AA] transition-colors"
                disabled={disabled || isGenerating}
              >
                {selectedModel.label}
                <ChevronDown className="w-2.5 h-2.5 text-[#52525B]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-zinc-500">Select Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MODELS.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => onModelChange?.(m.id)}
                  className={model === m.id ? 'bg-zinc-800' : ''}
                >
                  <span className="text-sm">{m.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Paperclip / Attach */}
            <DropdownMenu open={showAttachMenu} onOpenChange={setShowAttachMenu}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md text-[#52525B] hover:text-[#71717A] transition-colors"
                  disabled={disabled || isBusy}
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
                      <DropdownMenuItem key={node.nodeId} onClick={() => handleNodeReference(node)}>
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
