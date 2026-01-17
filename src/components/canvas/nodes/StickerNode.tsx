'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import type { StickerNode as StickerNodeType, StickerSize } from '@/lib/types';
import {
  Trash2,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Smile,
  ChevronDown,
} from 'lucide-react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';

const SIZE_VALUES: Record<StickerSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const SIZE_LABELS: Record<StickerSize, string> = {
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL',
};

function StickerNodeComponent({ id, data, selected }: NodeProps<StickerNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const [showPicker, setShowPicker] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const size = SIZE_VALUES[data.size || 'md'];
  const rotation = data.rotation || 0;
  const opacity = data.opacity ?? 100;
  const flipX = data.flipX || false;
  const flipY = data.flipY || false;

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowSizeMenu(false);
        setShowOpacitySlider(false);
      }
    };

    if (showPicker || showSizeMenu || showOpacitySlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker, showSizeMenu, showOpacitySlider]);

  const handleEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      updateNodeData(id, { emoji: emojiData.emoji });
      setShowPicker(false);
    },
    [id, updateNodeData]
  );

  const handleSizeChange = useCallback(
    (newSize: StickerSize) => {
      updateNodeData(id, { size: newSize });
      setShowSizeMenu(false);
    },
    [id, updateNodeData]
  );

  const handleRotateLeft = useCallback(() => {
    updateNodeData(id, { rotation: (rotation - 15 + 360) % 360 });
  }, [id, rotation, updateNodeData]);

  const handleRotateRight = useCallback(() => {
    updateNodeData(id, { rotation: (rotation + 15) % 360 });
  }, [id, rotation, updateNodeData]);

  const handleFlipX = useCallback(() => {
    updateNodeData(id, { flipX: !flipX });
  }, [id, flipX, updateNodeData]);

  const handleFlipY = useCallback(() => {
    updateNodeData(id, { flipY: !flipY });
  }, [id, flipY, updateNodeData]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { opacity: parseInt(e.target.value) });
    },
    [id, updateNodeData]
  );

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  // Build transform string
  const transform = [
    rotation !== 0 ? `rotate(${rotation}deg)` : '',
    flipX ? 'scaleX(-1)' : '',
    flipY ? 'scaleY(-1)' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative" ref={pickerRef}>
      {/* Rich Toolbar - appears above node when selected */}
      {selected && (
        <div
          ref={toolbarRef}
          className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-zinc-800/95 backdrop-blur rounded-lg px-1.5 py-1 border border-zinc-700/50 shadow-xl z-10"
        >
          {/* Emoji picker button */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            onClick={() => setShowPicker(true)}
            title="Change emoji"
          >
            <Smile className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Size dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 gap-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 text-xs font-medium"
              onClick={() => setShowSizeMenu(!showSizeMenu)}
            >
              {SIZE_LABELS[data.size || 'md']}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showSizeMenu && (
              <div className="absolute top-full mt-1 left-0 bg-zinc-800 rounded-lg border border-zinc-700 shadow-xl overflow-hidden z-20">
                {(Object.keys(SIZE_VALUES) as StickerSize[]).map((sizeKey) => (
                  <button
                    key={sizeKey}
                    onClick={() => handleSizeChange(sizeKey)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-zinc-700 ${
                      data.size === sizeKey ? 'text-white bg-zinc-700' : 'text-zinc-400'
                    }`}
                  >
                    {SIZE_LABELS[sizeKey]} ({SIZE_VALUES[sizeKey]}px)
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Rotation controls */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            onClick={handleRotateLeft}
            title="Rotate left (15°)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            onClick={handleRotateRight}
            title="Rotate right (15°)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-zinc-700/50 mx-0.5" />

          {/* Flip controls */}
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${flipX ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={handleFlipX}
            title="Flip horizontal"
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 hover:bg-zinc-700/50 ${flipY ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={handleFlipY}
            title="Flip vertical"
          >
            <FlipVertical className="h-3.5 w-3.5" />
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
                  min="10"
                  max="100"
                  value={opacity}
                  onChange={handleOpacityChange}
                  className="w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
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

      {/* Sticker Display */}
      <div
        className={`
          cursor-pointer select-none
          transition-all duration-150
          ${selected ? 'drop-shadow-lg' : 'drop-shadow-md'}
        `}
        onDoubleClick={() => setShowPicker(true)}
        style={{
          fontSize: size,
          lineHeight: 1,
          transform: transform || undefined,
          opacity: opacity / 100,
        }}
      >
        {data.emoji || '👍'}
      </div>

      {/* Emoji Picker */}
      {showPicker && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            searchPlaceholder="Search emoji..."
            width={320}
            height={400}
            skinTonesDisabled
            lazyLoadEmojis
          />
        </div>
      )}

      {/* Hint text when selected */}
      {selected && !showPicker && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500 whitespace-nowrap">
          Double-click to change emoji
        </div>
      )}
    </div>
  );
}

export const StickerNode = memo(StickerNodeComponent);
