'use client';

/**
 * StoryboardChatInput
 *
 * Simplified chat input for storyboard refinement.
 * Auto-resizing textarea, send/stop buttons, message queue.
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { ArrowUp, Square, ChevronDown, Pencil, Trash2, Send } from 'lucide-react';

interface QueuedMessage {
  id: string;
  content: string;
}

interface StoryboardChatInputProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function StoryboardChatInput({
  onSubmit,
  onStop,
  isGenerating,
  disabled,
  placeholder = 'Refine the storyboard...',
}: StoryboardChatInputProps) {
  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [showQueue, setShowQueue] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = isGenerating || disabled;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '20px';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, [message]);

  // Focus edit textarea
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editingId]);

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;

    if (isBusy) {
      // Queue the message
      setQueue((prev) => [...prev, { id: `q_${Date.now()}`, content: trimmed }]);
      setMessage('');
      return;
    }

    onSubmit(trimmed);
    setMessage('');
  }, [message, isBusy, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Process queue when generation finishes
  useEffect(() => {
    if (!isBusy && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      onSubmit(next.content);
    }
  }, [isBusy, queue, onSubmit]);

  // Queue management
  const deleteQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const startEditQueued = useCallback((msg: QueuedMessage) => {
    setEditingId(msg.id);
    setEditText(msg.content);
  }, []);

  const saveEditQueued = useCallback(() => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      deleteQueued(editingId);
    } else {
      setQueue((prev) => prev.map((m) => (m.id === editingId ? { ...m, content: trimmed } : m)));
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, deleteQueued]);

  const sendNow = useCallback(
    (id: string) => {
      const msg = queue.find((m) => m.id === id);
      if (!msg || isBusy) return;
      setQueue((prev) => prev.filter((m) => m.id !== id));
      onSubmit(msg.content);
    },
    [queue, isBusy, onSubmit]
  );

  return (
    <div className="border-t border-border bg-[#0D0F12]">
      {/* Message queue */}
      {queue.length > 0 && (
        <div className="px-3 pt-2">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-1 nodrag"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showQueue ? '' : '-rotate-90'}`} />
            {queue.length} queued message{queue.length > 1 ? 's' : ''}
          </button>
          {showQueue && (
            <div className="space-y-1 mb-1">
              {queue.map((msg) => (
                <div key={msg.id} className="flex items-start gap-1 bg-[#14161A] rounded px-2 py-1.5">
                  {editingId === msg.id ? (
                    <div className="flex-1">
                      <textarea
                        ref={editRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={saveEditQueued}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEditQueued();
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="w-full bg-transparent text-[11px] text-foreground resize-none outline-none nodrag"
                        rows={1}
                      />
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-[11px] text-foreground/80 line-clamp-2">{msg.content}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => startEditQueued(msg)} className="p-0.5 text-muted-foreground hover:text-foreground nodrag">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteQueued(msg.id)} className="p-0.5 text-muted-foreground hover:text-red-400 nodrag">
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {!isBusy && (
                          <button onClick={() => sendNow(msg.id)} className="p-0.5 text-muted-foreground hover:text-indigo-400 nodrag">
                            <Send className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBusy ? 'Message will be queued...' : placeholder}
          disabled={disabled && !isGenerating}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[20px] max-h-[100px] nodrag nowheel"
          rows={1}
        />
        {isGenerating && onStop ? (
          <button
            onClick={onStop}
            className="shrink-0 w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors nodrag"
          >
            <Square className="w-3 h-3 text-white fill-white" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!message.trim() && !isBusy}
            className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted disabled:text-muted-foreground flex items-center justify-center transition-colors nodrag"
          >
            <ArrowUp className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
