'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import { ChevronRight, Share2, Sparkles, Download, FileJson, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { exportAsJSON, exportAsPNG } from '@/lib/export-utils';
import { toast } from 'sonner';

export function Header() {
  const spaceName = useCanvasStore((state) => state.spaceName);
  const setSpaceName = useCanvasStore((state) => state.setSpaceName);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(spaceName);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportJSON = useCallback(() => {
    try {
      exportAsJSON(nodes, edges, spaceName);
      toast.success('Workflow exported as JSON');
    } catch (error) {
      toast.error('Failed to export workflow');
    }
    setShowExportMenu(false);
  }, [nodes, edges, spaceName]);

  const handleExportPNG = useCallback(async () => {
    try {
      const canvasElement = document.querySelector('.react-flow') as HTMLElement;
      if (canvasElement) {
        await exportAsPNG(canvasElement, spaceName);
        toast.success('Canvas exported as PNG');
      }
    } catch (error) {
      toast.error('Failed to export as PNG');
    }
    setShowExportMenu(false);
  }, [spaceName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(spaceName);
  }, [spaceName]);

  const handleSubmit = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim()) {
      setSpaceName(editValue.trim());
    } else {
      setEditValue(spaceName);
    }
  }, [editValue, spaceName, setSpaceName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        setEditValue(spaceName);
        setIsEditing(false);
      }
    },
    [handleSubmit, spaceName]
  );

  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4">
      {/* Left side - Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span>Spaces</span>
        </div>

        <ChevronRight className="h-4 w-4 text-zinc-600" />

        <span className="text-zinc-500">Personal</span>

        <ChevronRight className="h-4 w-4 text-zinc-600" />

        {/* Editable Space Name */}
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-zinc-600 mr-2" />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
              className="bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-zinc-200 text-sm outline-none focus:border-blue-500 min-w-[120px]"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-zinc-200 hover:text-white transition-colors cursor-text"
            >
              {spaceName}
            </button>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="h-8 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export
            <ChevronDown className={`h-3 w-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </Button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px] z-50">
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <FileJson className="h-4 w-4" />
                Export as JSON
              </button>
              <button
                onClick={handleExportPNG}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                Export as PNG
              </button>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
          A
        </div>
      </div>
    </header>
  );
}
