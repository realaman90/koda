'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';

export interface TokenSuggestion {
  label: string;
  url: string;
}

interface PromptTokenAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  suggestions: TokenSuggestion[];
  onInsert: (label: string) => void;
}

/**
 * Dropdown that appears inline (absolute-positioned relative to its parent)
 * when user types @ in the prompt textarea.
 */
export function PromptTokenAutocomplete({
  textareaRef,
  suggestions,
  onInsert,
}: PromptTokenAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const cursorStartRef = useRef<number>(0);

  const filteredSuggestions = suggestions.filter((s) =>
    s.label.toLowerCase().includes(filter.toLowerCase())
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setFilter('');
    setSelectedIndex(0);
  }, []);

  const insertToken = useCallback(
    (label: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = cursorStartRef.current;
      const end = textarea.selectionStart;
      const value = textarea.value;

      const before = value.slice(0, start);
      const after = value.slice(end);
      const token = `@${label} `;
      const newValue = before + token + after;

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      nativeInputValueSetter?.call(textarea, newValue);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      const newCursorPos = start + token.length;
      requestAnimationFrame(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });

      close();
      onInsert(label);
    },
    [textareaRef, close, onInsert]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInput = () => {
      const pos = textarea.selectionStart;
      const value = textarea.value;
      const textBefore = value.slice(0, pos);

      const lastAt = textBefore.lastIndexOf('@');
      if (lastAt < 0) {
        if (isOpen) close();
        return;
      }

      if (lastAt > 0 && !/\s/.test(textBefore[lastAt - 1])) {
        if (isOpen) close();
        return;
      }

      const partial = textBefore.slice(lastAt + 1);
      if (/^[a-zA-Z0-9_]*$/.test(partial) && suggestions.length > 0) {
        cursorStartRef.current = lastAt;
        setFilter(partial);
        setSelectedIndex(0);
        setIsOpen(true);
        return;
      }

      if (isOpen) close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev >= filteredSuggestions.length - 1 ? 0 : prev + 1
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? filteredSuggestions.length - 1 : prev - 1
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredSuggestions[selectedIndex]) {
          e.preventDefault();
          insertToken(filteredSuggestions[selectedIndex].label);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleKeyDown, true);
    return () => {
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [textareaRef, suggestions, isOpen, filteredSuggestions, selectedIndex, insertToken, close]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, close]);

  if (!isOpen || filteredSuggestions.length === 0) return null;

  // Render as absolute-positioned dropdown directly below this component's
  // location in the DOM (which is right after the textarea, inside the node).
  return (
    <div ref={popupRef} className="relative w-full nodrag nopan nowheel">
      <div className="absolute left-0 top-0 z-50 min-w-[180px] max-w-[260px] rounded-lg border border-border bg-popover p-1 shadow-lg">
        {filteredSuggestions.map((suggestion, index) => (
          <button
            key={suggestion.label}
            className={`
              flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs
              transition-colors
              ${index === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}
            `}
            onMouseDown={(e) => {
              e.preventDefault();
              insertToken(suggestion.label);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {suggestion.url ? (
              <img
                src={suggestion.url}
                alt=""
                className="h-5 w-5 rounded object-cover shrink-0"
                draggable={false}
              />
            ) : (
              <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">@{suggestion.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
