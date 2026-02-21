'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import type { StickyNoteNode as StickyNoteNodeType, StickyNoteColor, StickyNoteSize, TextAlign } from '@/lib/types';
import {
  Trash2,
  Palette,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  RotateCw,
  ChevronDown,
  Type,
} from 'lucide-react';

const COLORS: Record<StickyNoteColor, { bg: string; border: string; text: string; hex: string }> = {
  yellow: { bg: 'bg-yellow-200', border: 'border-yellow-300', text: 'text-yellow-900', hex: '#fef08a' },
  pink: { bg: 'bg-pink-200', border: 'border-pink-300', text: 'text-pink-900', hex: '#fbcfe8' },
  blue: { bg: 'bg-blue-200', border: 'border-blue-300', text: 'text-blue-900', hex: '#bfdbfe' },
  green: { bg: 'bg-green-200', border: 'border-green-300', text: 'text-green-900', hex: '#bbf7d0' },
  purple: { bg: 'bg-purple-200', border: 'border-purple-300', text: 'text-purple-900', hex: '#e9d5ff' },
  orange: { bg: 'bg-orange-200', border: 'border-orange-300', text: 'text-orange-900', hex: '#fed7aa' },
};

const COLOR_OPTIONS: StickyNoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

const SIZE_DIMENSIONS: Record<StickyNoteSize, number> = {
  sm: 160,
  md: 200,
  lg: 260,
};

const SIZE_LABELS: Record<StickyNoteSize, string> = {
  sm: 'S',
  md: 'M',
  lg: 'L',
};

const FONT_SIZES = [12, 14, 16, 18, 20, 24];

function StickyNoteNodeComponent({ id, data, selected }: NodeProps<StickyNoteNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);

  const colorConfig = COLORS[data.color || 'yellow'];
  const noteSize = SIZE_DIMENSIONS[data.size || 'md'];
  const textAlign = data.textAlign || 'left';
  const fontSize = data.fontSize || 14;
  const bold = data.bold || false;
  const italic = data.italic || false;
  const rotation = data.rotation || 0;
  const opacity = data.opacity ?? 100;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(60, textareaRef.current.scrollHeight)}px`;
    }
  }, [data.content, fontSize]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
        setShowSizeMenu(false);
        setShowFontSizeMenu(false);
        setShowOpacitySlider(false);
      }
    };

    if (showColorPicker || showSizeMenu || showFontSizeMenu || showOpacitySlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker, showSizeMenu, showFontSizeMenu, showOpacitySlider]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { content: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleAuthorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { author: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleColorChange = useCallback(
    (color: StickyNoteColor) => {
      updateNodeData(id, { color });
      setShowColorPicker(false);
    },
    [id, updateNodeData]
  );

  const handleSizeChange = useCallback(
    (size: StickyNoteSize) => {
      updateNodeData(id, { size });
      setShowSizeMenu(false);
    },
    [id, updateNodeData]
  );

  const handleFontSizeChange = useCallback(
    (newFontSize: number) => {
      updateNodeData(id, { fontSize: newFontSize });
      setShowFontSizeMenu(false);
    },
    [id, updateNodeData]
  );

  const handleTextAlignChange = useCallback(
    (align: TextAlign) => {
      updateNodeData(id, { textAlign: align });
    },
    [id, updateNodeData]
  );

  const handleBoldToggle = useCallback(() => {
    updateNodeData(id, { bold: !bold });
  }, [id, bold, updateNodeData]);

  const handleItalicToggle = useCallback(() => {
    updateNodeData(id, { italic: !italic });
  }, [id, italic, updateNodeData]);

  const handleRotateLeft = useCallback(() => {
    updateNodeData(id, { rotation: (rotation - 5 + 360) % 360 });
  }, [id, rotation, updateNodeData]);

  const handleRotateRight = useCallback(() => {
    updateNodeData(id, { rotation: (rotation + 5) % 360 });
  }, [id, rotation, updateNodeData]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { opacity: parseInt(e.target.value) });
    },
    [id, updateNodeData]
  );

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  return (
    <div className="relative">
      {/* Rich Toolbar - appears above node when selected */}
      {selected && (
        <div
          ref={toolbarRef}
          className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-zinc-800/95 backdrop-blur rounded-lg px-1.5 py-1 border border-zinc-700/50 shadow-xl z-10"
        >
          {/* Color picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Note color"
            >
              <div
                className="w-4 h-4 rounded border border-zinc-600"
                style={{ backgroundColor: colorConfig.hex }}
              />
            </Button>
            {showColorPicker && (
              <div className="absolute top-full mt-1 left-0 flex gap-1 flex-wrap w-[90px] bg-zinc-800 rounded-lg p-1.5 border border-zinc-700 shadow-xl z-20">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={`w-5 h-5 rounded ${COLORS[color].bg} ${
                      data.color === color ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-800' : ''
                    } hover:scale-110 transition-transform`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Size dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 gap-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 text-xs font-medium"
              onClick={() => setShowSizeMenu(!showSizeMenu)}
              title="Note size"
            >
              {SIZE_LABELS[data.size || 'md']}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showSizeMenu && (
              <div className="absolute top-full mt-1 left-0 bg-zinc-800 rounded-lg border border-zinc-700 shadow-xl overflow-hidden z-20">
                {(Object.keys(SIZE_DIMENSIONS) as StickyNoteSize[]).map((sizeKey) => (
                  <button
                    key={sizeKey}
                    onClick={() => handleSizeChange(sizeKey)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-zinc-700 ${
                      (data.size || 'md') === sizeKey ? 'text-white bg-zinc-700' : 'text-zinc-400'
                    }`}
                  >
                    {SIZE_LABELS[sizeKey]} ({SIZE_DIMENSIONS[sizeKey]}px)
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Font size dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 gap-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 text-xs font-medium"
              onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
              title="Font size"
            >
              <Type className="h-3 w-3" />
              {fontSize}
            </Button>
            {showFontSizeMenu && (
              <div className="absolute top-full mt-1 left-0 bg-zinc-800 rounded-lg border border-zinc-700 shadow-xl overflow-hidden z-20">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-zinc-700 ${
                      fontSize === size ? 'text-white bg-zinc-700' : 'text-zinc-400'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bold / Italic */}
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${bold ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={handleBoldToggle}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${italic ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={handleItalicToggle}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Text alignment */}
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${textAlign === 'left' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => handleTextAlignChange('left')}
            title="Align left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${textAlign === 'center' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => handleTextAlignChange('center')}
            title="Align center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${textAlign === 'right' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => handleTextAlignChange('right')}
            title="Align right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Rotation controls */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            onClick={handleRotateLeft}
            title="Rotate left (5°)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            onClick={handleRotateRight}
            title="Rotate right (5°)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Opacity slider */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 text-xs font-medium min-w-[36px]"
              onClick={() => setShowOpacitySlider(!showOpacitySlider)}
              title="Opacity"
            >
              {opacity}%
            </Button>
            {showOpacitySlider && (
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-zinc-800 rounded-lg border border-zinc-700 shadow-xl p-2 z-20">
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={opacity}
                  onChange={handleOpacityChange}
                  className="w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50"
            onClick={handleDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Main Sticky Note Card */}
      <div
        className={`
          rounded-lg overflow-hidden shadow-lg
          ${colorConfig.bg} ${colorConfig.border} border-2
          transition-[box-shadow,ring-color] duration-150
          ${selected ? 'ring-2 ring-blue-500 shadow-xl' : ''}
        `}
        style={{
          width: noteSize,
          minHeight: noteSize * 0.75,
          transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
          opacity: opacity / 100,
          boxShadow: selected
            ? '0 10px 25px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.2)'
            : '0 4px 15px rgba(0,0,0,0.15), 0 2px 5px rgba(0,0,0,0.1)',
        }}
      >
        {/* Content Area */}
        <div className="p-3 flex flex-col h-full">
          <textarea
            ref={textareaRef}
            value={data.content}
            onChange={handleContentChange}
            placeholder="Write a note..."
            className={`
              w-full bg-transparent border-none resize-none focus:outline-none
              min-h-[60px] leading-relaxed
              ${colorConfig.text} placeholder:opacity-50
            `}
            style={{
              fontFamily: 'inherit',
              fontSize: `${fontSize}px`,
              fontWeight: bold ? 'bold' : 'normal',
              fontStyle: italic ? 'italic' : 'normal',
              textAlign: textAlign,
            }}
          />

          {/* Author section */}
          <div className="mt-auto pt-2 border-t border-current opacity-30">
            <input
              type="text"
              value={data.author || ''}
              onChange={handleAuthorChange}
              placeholder="- Author"
              className={`
                w-full bg-transparent border-none text-xs italic focus:outline-none
                ${colorConfig.text} placeholder:opacity-50
              `}
              style={{ textAlign: textAlign }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeComponent);
