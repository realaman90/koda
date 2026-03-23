'use client';

import { forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  ChevronDown,
  Maximize2,
  Minimize2,
  PaintBucket,
  Trash2,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const TEXT_COLORS = [
  { name: 'Default', color: null },
  { name: 'White', color: '#ffffff' },
  { name: 'Gray', color: '#9ca3af' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pink', color: '#ec4899' },
];

const BG_COLORS = [
  { name: 'Dark', color: '#1a1a1c' },
  { name: 'Charcoal', color: '#27272a' },
  { name: 'Slate', color: '#334155' },
  { name: 'Navy', color: '#1e3a5f' },
  { name: 'White', color: '#ffffff' },
  { name: 'Warm Gray', color: '#f5f5f4' },
  { name: 'Sky', color: '#e0f2fe' },
  { name: 'Mint', color: '#d1fae5' },
  { name: 'Lavender', color: '#ede9fe' },
  { name: 'Transparent', color: 'transparent' },
];

const HEADING_OPTIONS = [
  { label: 'Paragraph', level: 0 },
  { label: 'Heading 1', level: 1 },
  { label: 'Heading 2', level: 2 },
  { label: 'Heading 3', level: 3 },
];

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-zinc-700/50 transition-colors disabled:opacity-50',
        isActive && 'bg-zinc-700 text-white'
      )}
    >
      {children}
    </button>
  );
}

interface ColorPickerProps {
  editor: Editor;
}

function ColorPicker({ editor }: ColorPickerProps) {
  const currentColor = editor.getAttributes('textStyle').color || '#ffffff';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-zinc-700/50 transition-colors flex items-center gap-1"
          title="Text color"
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-zinc-600"
            style={{ backgroundColor: currentColor }}
          />
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {TEXT_COLORS.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                if (item.color) {
                  editor.chain().focus().setColor(item.color).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
              }}
              className={cn(
                'w-7 h-7 rounded-full border-2 border-zinc-600 hover:border-zinc-400 transition-colors',
                !item.color && 'bg-gradient-to-br from-red-500 via-green-500 to-blue-500'
              )}
              style={item.color ? { backgroundColor: item.color } : undefined}
              title={item.name}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface BgColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

function BgColorPicker({ currentColor, onColorChange }: BgColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-zinc-700/50 transition-colors flex items-center gap-1"
          title="Background color"
        >
          <PaintBucket className="w-4 h-4 text-zinc-400" />
          <div
            className="w-3 h-3 rounded border border-zinc-600"
            style={{ backgroundColor: currentColor || '#1a1a1c' }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {BG_COLORS.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => onColorChange(item.color)}
              className={cn(
                'w-7 h-7 rounded border-2 hover:border-zinc-400 transition-colors',
                currentColor === item.color ? 'border-blue-500' : 'border-zinc-600',
                item.color === 'transparent' && 'bg-[repeating-linear-gradient(45deg,#3f3f46,#3f3f46_2px,#27272a_2px,#27272a_4px)]'
              )}
              style={item.color !== 'transparent' ? { backgroundColor: item.color } : undefined}
              title={item.name}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface HeadingDropdownProps {
  editor: Editor;
}

function HeadingDropdown({ editor }: HeadingDropdownProps) {
  const getCurrentHeading = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    return 'Paragraph';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="px-2 py-1.5 rounded hover:bg-zinc-700/50 transition-colors flex items-center gap-1 text-sm text-zinc-300 min-w-[90px]"
        >
          {getCurrentHeading()}
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {HEADING_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.label}
            onClick={() => {
              if (option.level === 0) {
                editor.chain().focus().setParagraph().run();
              } else {
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: option.level as 1 | 2 | 3 })
                  .run();
              }
            }}
            className={cn(
              option.level === 1 && 'text-lg font-bold',
              option.level === 2 && 'text-base font-semibold',
              option.level === 3 && 'text-sm font-medium'
            )}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface EditorToolbarProps {
  editor: Editor | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  bgColor: string;
  onBgColorChange: (color: string) => void;
  onDelete?: () => void;
}

export function EditorToolbar({
  editor,
  isExpanded,
  onToggleExpand,
  bgColor,
  onBgColorChange,
  onDelete,
}: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5">
      {/* Expand/Minimize */}
      <ToolbarButton onClick={onToggleExpand} title={isExpanded ? 'Minimize' : 'Expand'}>
        {isExpanded ? (
          <Minimize2 className="w-4 h-4 text-zinc-400" />
        ) : (
          <Maximize2 className="w-4 h-4 text-zinc-400" />
        )}
      </ToolbarButton>

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Text Color Picker */}
      <ColorPicker editor={editor} />

      {/* Background Color Picker */}
      <BgColorPicker currentColor={bgColor} onColorChange={onBgColorChange} />

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Heading Dropdown */}
      <HeadingDropdown editor={editor} />

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Bold */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-4 h-4 text-zinc-300" />
      </ToolbarButton>

      {/* Italic */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-4 h-4 text-zinc-300" />
      </ToolbarButton>

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Bullet List */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="w-4 h-4 text-zinc-300" />
      </ToolbarButton>

      {/* Ordered List */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4 text-zinc-300" />
      </ToolbarButton>

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Horizontal Rule */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus className="w-4 h-4 text-zinc-300" />
      </ToolbarButton>

      {/* Delete Node */}
      {onDelete && (
        <>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <ToolbarButton onClick={onDelete} title="Delete node">
            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

export interface RichTextEditorRef {
  getEditor: () => Editor | null;
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: number;
  isExpanded?: boolean;
  editable?: boolean;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor({
    content,
    onChange,
    placeholder = 'Start typing...',
    minHeight = 80,
    isExpanded = false,
    editable = true,
  }, ref) {
    const editor = useEditor({
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        TextStyle,
        Color,
        Underline,
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
      ],
      content,
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-invert prose-sm max-w-none focus:outline-none',
            'prose-headings:font-bold prose-headings:text-zinc-100',
            'prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-2',
            'prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-2',
            'prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-1',
            'prose-p:text-zinc-300 prose-p:my-1',
            'prose-li:text-zinc-300',
            'prose-hr:border-zinc-700'
          ),
        },
      },
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
    });

    useImperativeHandle(ref, () => ({
      getEditor: () => editor,
    }));

    if (!editor) {
      return null;
    }

    return (
      <div
        className="w-full overflow-auto nodrag nowheel"
        style={{ minHeight: isExpanded ? minHeight * 2 : minHeight }}
      >
        <EditorContent
          editor={editor}
          className="w-full cursor-text [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child]:before:text-zinc-600 [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:pointer-events-none"
        />
      </div>
    );
  }
);
