'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Copy, Trash2, Calendar, AlertCircle, Loader2, ImageOff, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasMetadata } from '@/lib/storage';

interface CanvasCardProps {
  canvas: CanvasMetadata;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRefreshPreview?: (id: string) => void;
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

export function CanvasCard({ canvas, onRename, onDuplicate, onDelete, onRefreshPreview }: CanvasCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(canvas.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewStatus = useMemo(() => {
    if (canvas.thumbnailStatus === 'ready' && canvas.thumbnailUpdatedAt && canvas.updatedAt > canvas.thumbnailUpdatedAt) {
      return 'stale';
    }
    if (canvas.thumbnailStatus === 'error') return 'error';
    if (canvas.thumbnailStatus === 'processing') return 'processing';
    if (canvas.thumbnailStatus === 'stale') return 'stale';
    if (canvas.thumbnailUrl || canvas.thumbnail) return 'ready';
    return 'empty';
  }, [canvas.thumbnail, canvas.thumbnailStatus, canvas.thumbnailUpdatedAt, canvas.thumbnailUrl, canvas.updatedAt]);

  const previewSrc = canvas.thumbnailUrl || canvas.thumbnail;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleMenuAction = (action: 'rename' | 'duplicate' | 'delete' | 'refresh') => {
    setShowMenu(false);
    if (action === 'rename') {
      setIsRenaming(true);
    } else if (action === 'duplicate') {
      onDuplicate(canvas.id);
    } else if (action === 'refresh') {
      onRefreshPreview?.(canvas.id);
    } else {
      onDelete(canvas.id);
    }
  };

  return (
    <article className="group relative rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md">
      <Link href={`/canvas/${canvas.id}`} className="block rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]">
        <div className="relative aspect-video overflow-hidden rounded-t-xl bg-muted">
          {previewStatus === 'ready' || previewStatus === 'stale' ? (
            <img
              src={previewSrc}
              alt={`${canvas.name} preview`}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              {previewStatus === 'processing' ? (
                <div className="flex items-center gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating preview…
                </div>
              ) : previewStatus === 'error' ? (
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4 w-4" />
                  Preview failed
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <ImageOff className="h-4 w-4" />
                  No preview yet
                </div>
              )}
            </div>
          )}

          {previewStatus === 'stale' && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
              <Clock3 className="h-3 w-3" />
              Stale
            </span>
          )}
        </div>
      </Link>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-border bg-muted px-2 py-1 text-sm text-foreground outline-none focus:border-[#3b82f6]"
              />
            ) : (
              <Link href={`/canvas/${canvas.id}`}>
                <h3 className="truncate text-sm font-medium text-foreground">{canvas.name}</h3>
              </Link>
            )}
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatRelativeTime(canvas.updatedAt)}</span>
              <span className="mx-1">·</span>
              <span>{canvas.nodeCount} nodes</span>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((s) => !s)}
              aria-label={`Open actions for ${canvas.name}`}
              className={cn(
                'rounded p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-popover py-1 shadow-xl">
                <button
                  onClick={() => handleMenuAction('rename')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  onClick={() => handleMenuAction('duplicate')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <button
                  onClick={() => handleMenuAction('refresh')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <Loader2 className="h-3.5 w-3.5" />
                  Refresh preview
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={() => handleMenuAction('delete')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
