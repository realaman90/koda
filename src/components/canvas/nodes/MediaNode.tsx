'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCanvasStore } from '@/stores/canvas-store';
import type { MediaNode as MediaNodeType } from '@/lib/types';
import { Image as ImageIcon, Upload, Trash2, X, Link } from 'lucide-react';

function MediaNodeComponent({ id, data, selected }: NodeProps<MediaNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState('Media');
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { url: undefined });
  }, [id, updateNodeData]);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        updateNodeData(id, { url, type: 'image' });
        toast.success('Image uploaded');
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      updateNodeData(id, { url: urlInput.trim(), type: 'image' });
      setUrlInput('');
      setShowUrlInput(false);
      toast.success('Image URL added');
    }
  }, [id, urlInput, updateNodeData]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Floating Toolbar - appears above node when selected (hidden in read-only) */}
      {selected && !isReadOnly && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg px-2 py-1.5 node-toolbar-floating z-10">
          {data.url && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-media)' }}>
        <ImageIcon className="h-4 w-4" />
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
                setNodeName('Media');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b outline-none px-0.5 min-w-[60px]"
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

      {/* Main Node Card */}
      <div
        className={`
          w-[280px] rounded-2xl overflow-hidden
          transition-all duration-150
          ${selected ? 'node-card-selected' : 'node-card'}
        `}
      >
        {/* Content Area */}
        <div className="relative min-h-[160px]">
          {data.url ? (
            /* Image Preview */
            <div className="relative">
              <img
                src={data.url}
                alt="Media"
                className="w-full h-auto"
              />
            </div>
          ) : (
            /* Upload Zone - disabled in read-only mode */
            <div
              onDrop={!isReadOnly ? handleDrop : undefined}
              onDragOver={!isReadOnly ? handleDragOver : undefined}
              onDragLeave={!isReadOnly ? handleDragLeave : undefined}
              onClick={!isReadOnly ? handleClick : undefined}
              className={`
                min-h-[160px] flex flex-col items-center justify-center p-4
                transition-colors
                ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}
                ${isDragging
                  ? 'bg-blue-500/10 border-2 border-dashed border-blue-500'
                  : !isReadOnly ? 'hover:opacity-80' : ''
                }
              `}
            >
              <Upload className="h-8 w-8 mb-3" style={{ color: 'var(--text-placeholder)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {isReadOnly ? 'No image' : 'Drop image here'}
              </p>
              {!isReadOnly && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-placeholder)' }}>or click to browse</p>
              )}

              {/* URL Input Toggle - hidden in read-only mode */}
              {!isReadOnly && (
                !showUrlInput ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUrlInput(true);
                    }}
                    className="mt-4 flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Link className="h-3 w-3" />
                    Paste URL
                  </button>
                ) : (
                  <div
                    className="mt-4 flex items-center gap-2 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUrlSubmit();
                        if (e.key === 'Escape') setShowUrlInput(false);
                      }}
                      placeholder="Image URL..."
                      className="flex-1 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 node-input"
                      style={{ borderWidth: '1px' }}
                      autoFocus
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={handleUrlSubmit}
                      className="h-6 w-6"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Link className="h-3 w-3" />
                    </Button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Output Handle - Right side */}
      <div
        className={`absolute -right-3 group transition-opacity duration-200 ${selected || isHovered || data.url ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-red-400 !border-zinc-900 hover:!border-zinc-700"
          />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Image output
        </span>
      </div>
    </div>
  );
}

export const MediaNode = memo(MediaNodeComponent);
