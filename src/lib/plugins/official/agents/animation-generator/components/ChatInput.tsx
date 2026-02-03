'use client';

/**
 * ChatInput Component
 *
 * Rich chat input matching the Pencil design spec exactly:
 * - Rounded box (10px) with #27272a fill and #3f3f46 stroke
 * - Textarea with placeholder
 * - Bottom bar: model selector (left) + paperclip + send button (right)
 * - Send button: 28px blue circle with arrow-up icon
 */

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { ArrowUp, Square, Paperclip, ChevronDown, Image, Video, Link2 } from 'lucide-react';
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

interface ChatInputProps {
  onSubmit: (message: string, attachments?: AnimationAttachment[]) => void;
  onStop?: () => void;
  isGenerating?: boolean;
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
  disabled,
  placeholder = 'Describe the animation you want...',
  model = 'anthropic/claude-sonnet-4-5',
  onModelChange,
  attachments = [],
  onAttachmentsChange,
  availableNodeOutputs = [],
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

  const handleSubmit = useCallback(() => {
    if (isGenerating && onStop) {
      onStop();
      return;
    }
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSubmit(trimmedMessage, attachments.length > 0 ? attachments : undefined);
      setMessage('');
    }
  }, [message, isGenerating, disabled, onStop, onSubmit, attachments]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
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

  const canSend = !disabled && (isGenerating || message.trim().length > 0);

  return (
    <div className="px-3 pt-2 pb-2.5 border-t border-[#27272a]">
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
            placeholder={placeholder}
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
                  disabled={disabled || isGenerating}
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

            {/* Send / Stop button */}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                isGenerating
                  ? 'bg-[#52525B] hover:bg-[#71717A]'
                  : canSend
                  ? 'bg-[#3B82F6] hover:bg-[#2563EB]'
                  : 'bg-[#3B82F6] opacity-40 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <Square className="w-3 h-3 text-white" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-white" />
              )}
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
