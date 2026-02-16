'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { ImageIcon, Video } from 'lucide-react';

// ==========================================
// Types
// ==========================================

export interface MentionItem {
  id: string;
  label: string;
  type: 'image' | 'video';
}

interface MentionEditorProps {
  content: string;
  onChange: (text: string) => void;
  items: MentionItem[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// ==========================================
// Suggestion Popup Component
// ==========================================

interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

const MentionListComponent = forwardRef<
  { onKeyDown: (event: KeyboardEvent) => boolean },
  MentionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command({ id: item.id, label: item.label });
      }
    },
    [props]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) =>
          prev <= 0 ? props.items.length - 1 : prev - 1
        );
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) =>
          prev >= props.items.length - 1 ? 0 : prev + 1
        );
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="mention-popup">
        <div className="px-3 py-2 text-xs text-zinc-500">
          No connected references
        </div>
      </div>
    );
  }

  return (
    <div className="mention-popup">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          className={`mention-popup-item ${
            index === selectedIndex ? 'is-selected' : ''
          }`}
          onClick={() => selectItem(index)}
        >
          {item.type === 'image' ? (
            <ImageIcon className="h-3.5 w-3.5 text-red-400 shrink-0" />
          ) : (
            <Video className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          )}
          <span className="text-zinc-200">@{item.label}</span>
          <span className="ml-auto text-emerald-400 text-[10px]">
            Connected
          </span>
        </button>
      ))}
    </div>
  );
});
MentionListComponent.displayName = 'MentionList';

// ==========================================
// Suggestion Config
// ==========================================

function createSuggestion(
  itemsRef: React.RefObject<MentionItem[]>
) {
  return {
    char: '@',
    items: ({ query }: { query: string }) => {
      const items = itemsRef.current || [];
      if (!query) return items;
      return items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
    },
    render: () => {
      let renderer: ReactRenderer<any, MentionListProps> | null = null;
      let container: HTMLDivElement | null = null;

      return {
        onStart(props: any) {
          container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.zIndex = '9999';
          document.body.appendChild(container);

          renderer = new ReactRenderer(MentionListComponent, {
            props: { items: props.items, command: props.command },
            editor: props.editor,
          });
          container.appendChild(renderer.element);

          const rect = props.clientRect?.();
          if (rect && container) {
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.bottom + 4}px`;
          }
        },
        onUpdate(props: any) {
          renderer?.updateProps({
            items: props.items,
            command: props.command,
          });
          const rect = props.clientRect?.();
          if (rect && container) {
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.bottom + 4}px`;
          }
        },
        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            container?.remove();
            renderer?.destroy();
            return true;
          }
          return (renderer?.ref as any)?.onKeyDown(props.event) ?? false;
        },
        onExit() {
          container?.remove();
          renderer?.destroy();
        },
      };
    },
  };
}

// ==========================================
// Text <-> Content Conversion
// ==========================================

function textToHTML(text: string): string {
  if (!text) return '<p></p>';

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Replace @mentions with mention node markup
  const withMentions = escaped.replace(
    /@(image|video)(\d+)/gi,
    (_, type, num) => {
      const label = `${type.toLowerCase()}${num}`;
      return `<span data-type="mention" data-id="${label}" data-label="${label}">@${label}</span>`;
    }
  );

  // Split into paragraphs on newlines
  return withMentions
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
}

function jsonToText(json: any): string {
  if (!json?.content) return '';

  const lines: string[] = [];
  for (const block of json.content) {
    if (block.type === 'paragraph') {
      let line = '';
      if (block.content) {
        for (const node of block.content) {
          if (node.type === 'text') {
            line += node.text;
          } else if (node.type === 'mention') {
            line += `@${node.attrs.label || node.attrs.id}`;
          }
        }
      }
      lines.push(line);
    }
  }
  return lines.join('\n');
}

// ==========================================
// Main Editor Component
// ==========================================

export function MentionEditor({
  content,
  onChange,
  items,
  placeholder: placeholderText,
  disabled,
  className,
}: MentionEditorProps) {
  const itemsRef = useRef<MentionItem[]>(items);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention-chip' },
        renderHTML({ options, node }) {
          const label = node.attrs.label || node.attrs.id;
          const isImage = label.startsWith('image');
          return [
            'span',
            {
              ...options.HTMLAttributes,
              'data-mention-type': isImage ? 'image' : 'video',
            },
            `@${label}`,
          ];
        },
        suggestion: createSuggestion(itemsRef),
      }),
      Placeholder.configure({
        placeholder: placeholderText || 'Type something...',
      }),
    ],
    content: textToHTML(content),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const text = jsonToText(editor.getJSON());
      onChange(text);
      Promise.resolve().then(() => {
        isInternalUpdate.current = false;
      });
    },
    editorProps: {
      attributes: {
        class: 'mention-editor-content',
      },
    },
  });

  // Sync content from parent (only for external changes)
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return;
    const currentText = jsonToText(editor.getJSON());
    if (content !== currentText) {
      editor.commands.setContent(textToHTML(content));
    }
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
