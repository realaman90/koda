'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { KodaLogo } from '@/components/ui/KodaLogo';
import { Breadcrumbs, BreadcrumbItem } from './Breadcrumbs';
import {
  Search,
  ArrowLeft,
  Download,
  FileJson,
  Image as ImageIcon,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import { AccountMenu } from './AccountMenu';

interface TopBarProps {
  mode?: 'dashboard' | 'canvas';
  breadcrumbs?: BreadcrumbItem[];
  // Canvas mode props
  canvasName?: string;
  onCanvasNameChange?: (name: string) => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  lastSavedAt?: number | null;
  onExportJSON?: () => void;
  onExportPNG?: () => void;
  // Dashboard mode props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  className?: string;
}

export function TopBar({
  mode = 'dashboard',
  breadcrumbs = [],
  canvasName,
  onCanvasNameChange,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  onExportJSON,
  onExportPNG,
  searchQuery,
  onSearchChange,
  className,
}: TopBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

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

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    if (editValue.trim() && onCanvasNameChange) {
      onCanvasNameChange(editValue.trim());
    } else {
      setEditValue(canvasName || '');
    }
  }, [editValue, canvasName, onCanvasNameChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleNameSubmit();
      } else if (e.key === 'Escape') {
        setEditValue(canvasName || '');
        setIsEditingName(false);
      }
    },
    [handleNameSubmit, canvasName]
  );

  const { user, isLoading } = useCurrentUser();
  const isClerkUiEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const canRenameCanvas = mode === 'canvas' && Boolean(onCanvasNameChange);

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Format save status
  const formatSaveStatus = () => {
    if (isSaving) {
      return (
        <span className="flex items-center gap-1 text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </span>
      );
    }
    if (hasUnsavedChanges) {
      return <span className="text-amber-500">Unsaved changes</span>;
    }
    if (lastSavedAt) {
      return (
        <span className="flex items-center gap-1 text-green-500">
          <Check className="h-3 w-3" />
          Saved
        </span>
      );
    }
    return null;
  };

  return (
    <header
      className={cn(
        'h-14 border-b border-border/70 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70',
        'flex items-center justify-between',
        className
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Back button (canvas mode only) */}
        {mode === 'canvas' && (
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}

        {/* Logo/Brand */}
        <Link href="/" className="flex items-center rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/60">
          <KodaLogo variant="icon" size="md" className="sm:hidden" priority />
          <KodaLogo variant="full" size="md" className="hidden sm:block" priority />
        </Link>

        {/* Breadcrumbs or Canvas Name */}
        {mode === 'canvas' ? (
          <>
            <span className="text-border">/</span>
            <div className="flex items-center gap-2">
              {isEditingName && canRenameCanvas ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={handleKeyDown}
                  className="bg-muted border border-border rounded px-2 py-0.5 text-foreground text-sm outline-none focus:border-primary min-w-[120px]"
                />
              ) : (
                canRenameCanvas ? (
                  <button
                    onClick={() => {
                      setEditValue(canvasName || '');
                      setIsEditingName(true);
                    }}
                    className="text-foreground hover:text-foreground/80 transition-colors cursor-text text-sm font-medium"
                  >
                    {canvasName}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-foreground/90">
                    {canvasName}
                  </span>
                )
              )}
              <span className="text-xs">{formatSaveStatus()}</span>
            </div>
          </>
        ) : (
          breadcrumbs.length > 0 && (
            <>
              <span className="text-border/80">/</span>
              <Breadcrumbs items={breadcrumbs} />
            </>
          )
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {/* Search (dashboard mode only) */}
        {mode === 'dashboard' && onSearchChange && (
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-56 rounded-xl border border-border/70 bg-muted/50 pl-9 pr-14 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary/50"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </span>
          </div>
        )}

        {/* Canvas mode actions */}
        {mode === 'canvas' && (
          <>
            {/* Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="h-9 rounded-xl border-border/70 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    showExportMenu ? 'rotate-180' : ''
                  }`}
                />
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-border bg-popover py-1 shadow-xl">
                  <button
                    onClick={() => {
                      onExportJSON?.();
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
                  >
                    <FileJson className="h-4 w-4" />
                    Export as JSON
                  </button>
                  <button
                    onClick={() => {
                      onExportPNG?.();
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Export as PNG
                  </button>
                </div>
              )}
            </div>

{/* TODO: Share button hidden until sharing is implemented */}
          </>
        )}

        {/* User Menu / Avatar */}
        {isClerkUiEnabled ? (
          <AccountMenu user={user} displayName={displayName} initials={initials} isLoading={isLoading} />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-primary text-xs font-medium text-primary-foreground">
            {initials || 'U'}
          </div>
        )}
      </div>
    </header>
  );
}
