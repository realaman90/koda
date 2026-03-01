'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Copy, Trash2, Calendar, AlertCircle, Loader2, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasMetadata } from '@/lib/storage';
import { withThumbnailVersion } from '@/lib/preview-utils';
import { deriveCanvasPreviewState } from './canvas-preview-state';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const PREVIEW_SYSTEM_ENABLED = process.env.NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1 !== 'false';

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
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(canvas.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewStatus = useMemo(
    () => deriveCanvasPreviewState(canvas, PREVIEW_SYSTEM_ENABLED),
    [canvas],
  );

  const basePreviewSrc = canvas.thumbnailUrl || canvas.thumbnail;
  const previewSrc = useMemo(() => {
    if (!basePreviewSrc) return undefined;
    return withThumbnailVersion(basePreviewSrc, canvas.thumbnailVersion);
  }, [basePreviewSrc, canvas.thumbnailVersion]);

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

  const isReadOnly = canvas.accessRole === 'viewer';
  const surfaceBadge = canvas.workspaceType === 'team' ? 'Team' : 'Personal';

  const handleMenuAction = (action: 'rename' | 'duplicate' | 'delete') => {
    if (action === 'rename') {
      setIsRenaming(true);
    } else if (action === 'duplicate') {
      onDuplicate(canvas.id);
    } else {
      onDelete(canvas.id);
    }
  };

  return (
    <article className="group relative rounded-2xl border border-border/70 bg-card/85 shadow-[0_1px_0_rgba(255,255,255,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-xl focus-within:shadow-xl">
      <Link href={`/canvas/${canvas.id}`} className="block rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]">
        <div className="relative aspect-video overflow-hidden rounded-t-2xl bg-muted">
          {previewStatus === 'ready' ? (
            <img
              src={previewSrc}
              alt={`${canvas.name} preview`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-80" />
        </div>
      </Link>

      <div className="p-4">
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
                className="w-full rounded-lg border border-border bg-muted px-2 py-1 text-sm text-foreground outline-none focus:border-[#3b82f6]"
              />
            ) : (
              <Link href={`/canvas/${canvas.id}`}>
                <h3 className="truncate text-lg font-semibold leading-tight text-foreground">{canvas.name}</h3>
              </Link>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded-full border border-border/70 bg-muted/70 px-2 py-0.5 text-muted-foreground">{surfaceBadge}</span>
              {isReadOnly && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200">Read-only</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatRelativeTime(canvas.updatedAt)}</span>
              <span className="mx-1">·</span>
              <span>{canvas.nodeCount} nodes</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Open actions for ${canvas.name}`}
                className={cn(
                  'rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]'
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="min-w-[180px] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
            >
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  if (!isReadOnly) handleMenuAction('rename');
                }}
                disabled={isReadOnly}
                className="rounded-lg px-3 py-2 focus:bg-muted focus:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  if (!isReadOnly) handleMenuAction('duplicate');
                }}
                disabled={isReadOnly}
                className="rounded-lg px-3 py-2 focus:bg-muted focus:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </DropdownMenuItem>
              {isReadOnly && (
                <p className="px-3 py-2 text-xs text-muted-foreground">View-only access: editing is disabled.</p>
              )}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  if (!isReadOnly) handleMenuAction('delete');
                }}
                disabled={isReadOnly}
                className="rounded-lg px-3 py-2 text-red-500 focus:bg-red-500/10 focus:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
