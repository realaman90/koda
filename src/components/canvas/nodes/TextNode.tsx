'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useEdges } from '@xyflow/react';
import { useCanvasStore } from '@/stores/canvas-store';
import type { TextNode as TextNodeType } from '@/lib/types';
import { Type } from 'lucide-react';
import { RichTextEditor, EditorToolbar, type RichTextEditorRef } from './RichTextEditor';
import { ResizeHandle } from './ResizeHandle';

const DEFAULT_HEIGHT = 120;
const EXPANDED_HEIGHT = 300;

function TextNodeComponent({ id, data, selected }: NodeProps<TextNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const edges = useEdges();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Text');
  const [isHovered, setIsHovered] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichTextEditorRef>(null);

  // Use yellow/beige as default for text nodes (Freepik style), or custom bgColor if set
  const bgColor = data.bgColor || 'var(--node-bg-text)';
  const isExpanded = data.isExpanded || false;
  const isTransparent = bgColor === 'transparent';

  // Check if this node has any connections
  const isConnected = edges.some(edge => edge.source === id || edge.target === id);
  const showHandle = selected || isHovered || isConnected;

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    updateNodeData(id, { name: nodeName });
  }, [id, nodeName, updateNodeData]);

  const handleContentChange = useCallback(
    (content: string) => {
      updateNodeData(id, { content });
    },
    [id, updateNodeData]
  );

  const handleResizeEnd = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      updateNodeData(id, { width: params.width, height: params.height });
    },
    [id, updateNodeData]
  );

  const handleResize = useCallback(
    (width: number, height: number) => {
      updateNodeData(id, { width, height, isExpanded: height > DEFAULT_HEIGHT + 50 });
    },
    [id, updateNodeData]
  );

  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    updateNodeData(id, {
      isExpanded: newExpanded,
      height: newExpanded ? EXPANDED_HEIGHT : DEFAULT_HEIGHT
    });
  }, [id, isExpanded, updateNodeData]);

  const handleBgColorChange = useCallback(
    (color: string) => {
      updateNodeData(id, { bgColor: color });
    },
    [id, updateNodeData]
  );

  const deleteNode = useCanvasStore((state) => state.deleteNode);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const editor = editorRef.current?.getEditor() || null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Node Resizer - invisible handles, resize from edges (hidden in read-only) */}
      {!isReadOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={200}
          minHeight={120}
          lineClassName="!border-transparent"
          handleClassName="!opacity-0 !w-4 !h-4"
          onResizeEnd={handleResizeEnd}
        />
      )}

      {/* Floating Toolbar - appears above node when selected (hidden in read-only) */}
      {selected && !isReadOnly && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 node-toolbar-floating rounded-lg">
          <EditorToolbar
            editor={editor}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            bgColor={bgColor}
            onBgColorChange={handleBgColorChange}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-text)' }}>
        <Type className="h-4 w-4" />
        {isEditingName && !isReadOnly ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNodeName(data.name || 'Text');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b outline-none px-0.5 min-w-[60px] node-input"
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }}
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={`transition-colors hover:opacity-80 ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
          >
            {nodeName}
          </span>
        )}
      </div>

      {/* Main Node Card - wrapped for handle positioning */}
      <div className="relative">
        <div
          className={`
            min-w-[280px] rounded-2xl overflow-hidden
            transition-all duration-150
            ${isTransparent
              ? (selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent' : '')
              : (selected ? 'node-card-selected' : '')
            }
          `}
          style={{
            backgroundColor: isTransparent ? 'transparent' : bgColor,
            width: data.width || 280,
            height: data.height || DEFAULT_HEIGHT,
            ...(!isTransparent && !selected && {
              border: '1px solid var(--node-bg-text-border)',
              boxShadow: 'var(--node-card-shadow)',
            }),
          }}
        >
          {/* Content Area */}
          <div className="p-4 h-full">
            <RichTextEditor
              ref={editorRef}
              content={data.content}
              onChange={handleContentChange}
              placeholder="Enter your text..."
              minHeight={80}
              isExpanded={isExpanded}
              editable={!isReadOnly}
            />
          </div>
        </div>

        {/* Resize Handle - bottom-right corner of card (hidden in read-only) */}
        {!isReadOnly && (
          <div className="absolute -bottom-2 -right-2 z-10">
            <ResizeHandle
              onResize={handleResize}
              visible={isHovered || selected}
              currentWidth={data.width || 280}
              currentHeight={data.height || DEFAULT_HEIGHT}
              minWidth={200}
              minHeight={100}
              maxWidth={600}
              maxHeight={500}
            />
          </div>
        )}

        {/* Output Handle - Right side, centered on card */}
        <div
          className={`absolute -right-3 top-1/2 -translate-y-1/2 group transition-opacity duration-200 ${showHandle ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="relative">
            <Handle
              type="source"
              position={Position.Right}
              id="output"
              className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-yellow-400 !border-zinc-900 hover:!border-zinc-700"
            />
            <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
          </div>
          <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
            Text output
          </span>
        </div>
      </div>

    </div>
  );
}

export const TextNode = memo(TextNodeComponent);
