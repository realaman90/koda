'use client';

/**
 * ChatInput Component
 * 
 * Rich chat input with model selector, attachment button, node reference picker.
 * Based on Pencil design: animator plugin node Thinking and todo UI
 */

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Square, Paperclip, ChevronDown, Image, Video, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AnimationAttachment } from '../types';

// Available models (Mastra provider/model-name format)
const MODELS = [
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5', description: 'Fast & smart' },
  { id: 'anthropic/claude-haiku-3-5', label: 'Claude Haiku 3.5', description: 'Fastest' },
  { id: 'anthropic/claude-opus-4', label: 'Claude Opus 4', description: 'Most capable' },
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
      // Submit on Enter (without shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFileSelect = useCallback(
    (type: 'image' | 'video') => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
        fileInputRef.current.click();
      }
    },
    []
  );

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
      e.target.value = ''; // Reset input
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
      // Revoke blob URL if it's a local file (not a node reference)
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

  return (
    <div className="space-y-2">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs"
            >
              {attachment.type === 'image' ? (
                <Image className="h-3 w-3 text-teal-400" />
              ) : (
                <Video className="h-3 w-3 text-purple-400" />
              )}
              <span className="text-zinc-300 max-w-[100px] truncate">
                {attachment.name || (attachment.nodeId ? 'Node output' : 'File')}
              </span>
              {attachment.nodeId && <Link2 className="h-3 w-3 text-zinc-500" />}
              <button
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="ml-1 text-zinc-500 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="relative rounded-xl border border-zinc-700 bg-zinc-800/50 focus-within:border-zinc-600 transition-colors">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[60px] max-h-[120px] resize-none border-0 bg-transparent text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 pr-24"
          rows={2}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-700/50">
          {/* Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                disabled={disabled || isGenerating}
              >
                {selectedModel.label}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
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
                  <div>
                    <div className="text-sm">{m.label}</div>
                    <div className="text-xs text-zinc-500">{m.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Attachment menu */}
            <DropdownMenu open={showAttachMenu} onOpenChange={setShowAttachMenu}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                  disabled={disabled || isGenerating}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
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

            {/* Send/Stop button */}
            <Button
              onClick={handleSubmit}
              disabled={disabled || (!isGenerating && !message.trim())}
              size="sm"
              className={`h-7 w-7 p-0 rounded-full ${
                isGenerating
                  ? 'bg-zinc-600 hover:bg-zinc-500'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isGenerating ? (
                <Square className="h-3 w-3 text-white" />
              ) : (
                <Send className="h-3.5 w-3.5 text-white" />
              )}
            </Button>
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
