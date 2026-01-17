'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
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

  const handleResize = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      updateNodeData(id, { width: params.width, height: params.height });
    },
    [id, updateNodeData]
  );

  return (
    <>
      {/* Node Resizer */}
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-blue-500"
        handleClassName="!w-3 !h-3 !bg-blue-500 !border-white"
        onResize={handleResize}
      />

      {/* Floating Toolbar - appears above node when selected */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-800/90 backdrop-blur rounded-lg px-2 py-1.5 border border-zinc-700/50 shadow-xl z-10">
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

      {/* Main Group Container */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          width: data.width || 300,
          height: data.height || 200,
          backgroundColor: 'rgba(39, 39, 42, 0.5)',
          border: `2px dashed ${borderColor}`,
        }}
      >
        {/* Title Bar */}
        <div
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{
            borderColor: `${borderColor}40`,
            backgroundColor: `${borderColor}15`,
          }}
        >
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
              className="bg-transparent border-b border-zinc-600 outline-none text-zinc-200 text-sm font-medium px-0.5 min-w-[60px]"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingName(true)}
              className="text-sm font-medium cursor-text hover:text-zinc-100 transition-colors"
              style={{ color: borderColor }}
            >
              {data.name || 'Group'}
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="flex items-center justify-center h-[calc(100%-40px)] text-zinc-500 text-sm">
          Drag elements here
        </div>
      </div>
    </>
  );
}

export const GroupNode = memo(GroupNodeComponent);
