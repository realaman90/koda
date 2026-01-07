'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import type { TextNode as TextNodeType } from '@/lib/types';
import { Type, Trash2 } from 'lucide-react';

function TextNodeComponent({ id, data, selected }: NodeProps<TextNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState('Text');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(80, textareaRef.current.scrollHeight)}px`;
    }
  }, [data.content]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { content: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  return (
    <div className="relative">
      {/* Floating Toolbar - appears above node when selected */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-800/90 backdrop-blur rounded-lg px-2 py-1.5 border border-zinc-700/50 shadow-xl z-10">
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

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-zinc-400 text-sm font-medium">
        <Type className="h-4 w-4" />
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNodeName('Text');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b border-zinc-600 outline-none text-zinc-300 px-0.5 min-w-[60px]"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingName(true)}
            className="cursor-text hover:text-zinc-300 transition-colors"
          >
            {nodeName}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[280px] rounded-2xl overflow-hidden
          transition-all duration-150
          ${selected
            ? 'ring-[2.5px] ring-blue-500 shadow-lg shadow-blue-500/10'
            : 'ring-1 ring-zinc-800 hover:ring-zinc-700'
          }
        `}
        style={{ backgroundColor: '#1a1a1c' }}
      >
        {/* Content Area */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={data.content}
            onChange={handleContentChange}
            placeholder="Enter your text prompt..."
            className="w-full bg-transparent border-none text-zinc-300 text-sm placeholder:text-zinc-600 resize-none focus:outline-none min-h-[80px]"
          />
        </div>
      </div>

      {/* Output Handle - Right side */}
      <div className="absolute -right-3 group" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-6 !h-6 !bg-zinc-800 !border-2 !border-zinc-600 !rounded-md hover:!border-green-500 hover:!bg-zinc-700"
          />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
        </div>
        <span className="absolute right-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
          Text output
        </span>
      </div>
    </div>
  );
}

export const TextNode = memo(TextNodeComponent);
