'use client';

import { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { type NodeProps, NodeResizer } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import type { GroupNode as GroupNodeType } from '@/lib/types';
import { Trash2, Palette } from 'lucide-react';

const COLOR_OPTIONS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#71717a', label: 'Zinc' },
];

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const borderColor = data.color || '#6366f1';

  const containerStyle = useMemo(() => ({
    width: data.width || 400,
    height: data.height || 280,
    backgroundColor: `${borderColor}15`,
    border: `2px solid ${borderColor}${selected ? '' : '80'}`,
    boxShadow: selected ? `0 0 20px ${borderColor}30` : undefined,
  }), [data.width, data.height, borderColor, selected]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { name: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleColorChange = useCallback(
    (color: string) => {
      updateNodeData(id, { color });
      setShowColorPicker(false);
    },
    [id, updateNodeData]
  );

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const handleResizeEnd = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      updateNodeData(id, { width: params.width, height: params.height });
    },
    [id, updateNodeData]
  );

  return (
    <div
      className="relative rounded-2xl"
      style={containerStyle}
    >
      {/* Node Resizer - invisible handles, resize from edges */}
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-transparent"
        handleClassName="!opacity-0 !w-4 !h-4"
        onResizeEnd={handleResizeEnd}
      />

      {/* Floating Toolbar - appears above node when selected */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur rounded-lg px-2 py-1.5 border node-toolbar-floating shadow-xl z-10">
          {/* Color picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <Palette className="h-3.5 w-3.5" />
            </Button>
            {showColorPicker && (
              <div className="absolute top-full mt-1 left-0 flex gap-1 flex-wrap w-[130px] bg-zinc-800 rounded-lg p-1.5 border border-zinc-700 shadow-xl z-20">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    className={`w-5 h-5 rounded-full ${
                      data.color === color.value ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-800' : ''
                    } hover:scale-110 transition-transform`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-4 bg-zinc-700" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Title - Inside top-left of container */}
      <div className="absolute top-3 left-4">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={data.name}
            onChange={handleNameChange}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b border-zinc-600 outline-none text-sm font-medium px-0.5 min-w-[60px]"
            style={{ color: borderColor }}
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingName(true)}
            className="text-sm font-medium cursor-text hover:opacity-80 transition-opacity"
            style={{ color: borderColor }}
          >
            {data.name || 'New group'}
          </span>
        )}
      </div>

      {/* Content Area - centered placeholder text */}
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Drag elements here
      </div>

      {/* Custom Resize Handle Indicator (bottom-right corner) */}
      {selected && (
        <div className="absolute bottom-1 right-1 w-4 h-4 pointer-events-none">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="w-full h-full"
          >
            <path
              d="M14 16C14 16 16 16 16 14"
              stroke={borderColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10 16C10 16 16 16 16 10"
              stroke={borderColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M6 16C6 16 16 16 16 6"
              stroke={borderColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
