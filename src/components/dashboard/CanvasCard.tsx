'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Copy, Trash2, Calendar } from 'lucide-react';
import type { CanvasMetadata } from '@/lib/storage';

interface CanvasCardProps {
  canvas: CanvasMetadata;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function CanvasCard({ canvas, onRename, onDuplicate, onDelete }: CanvasCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(canvas.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    if (editName.trim() && editName.trim() !== canvas.name) {
      onRename(canvas.id, editName.trim());
    } else {
      setEditName(canvas.name);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(canvas.name);
      setIsRenaming(false);
    }
  };

  const handleMenuAction = (action: 'rename' | 'duplicate' | 'delete') => {
    setShowMenu(false);
    if (action === 'rename') {
      setIsRenaming(true);
    } else if (action === 'duplicate') {
      onDuplicate(canvas.id);
    } else if (action === 'delete') {
      onDelete(canvas.id);
    }
  };

  return (
    <div className="group relative bg-card border border-border rounded-xl hover:border-muted-foreground/30 transition-all hover:shadow-lg hover:shadow-background/50">
      {/* Thumbnail */}
      <Link href={`/canvas/${canvas.id}`}>
        <div className="aspect-video bg-muted flex items-center justify-center cursor-pointer overflow-hidden rounded-t-xl">
          {canvas.thumbnail ? (
            <img
              src={canvas.thumbnail}
              alt={canvas.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-4xl opacity-30">🖼️</div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                className="w-full bg-muted border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:border-indigo-500"
              />
            ) : (
              <Link href={`/canvas/${canvas.id}`}>
                <h3 className="text-sm font-medium text-foreground truncate hover:text-foreground cursor-pointer">
                  {canvas.name}
                </h3>
              </Link>
            )}
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatRelativeTime(canvas.updatedAt)}</span>
              <span className="mx-1">·</span>
              <span>{canvas.nodeCount} nodes</span>
            </div>
          </div>

          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[140px] z-50">
                <button
                  onClick={() => handleMenuAction('rename')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  onClick={() => handleMenuAction('duplicate')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => handleMenuAction('delete')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-muted transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
