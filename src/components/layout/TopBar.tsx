'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { KodaLogo } from '@/components/ui/KodaLogo';
import { Breadcrumbs, BreadcrumbItem } from './Breadcrumbs';
import {
  Search,
  ArrowLeft,
  Share2,
  Download,
  FileJson,
  Image as ImageIcon,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
        'h-12 bg-background border-b border-border flex items-center justify-between px-4',
        className
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Back button (canvas mode only) */}
        {mode === 'canvas' && (
          <Link
            href="/"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}

        {/* Logo/Brand */}
        <Link href="/" className="flex items-center">
          <KodaLogo variant="full" size="md" />
        </Link>

        {/* Breadcrumbs or Canvas Name */}
        {mode === 'canvas' ? (
          <>
            <span className="text-border">/</span>
            <div className="flex items-center gap-2">
              {isEditingName ? (
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
                <button
                  onClick={() => {
                    setEditValue(canvasName || '');
                    setIsEditingName(true);
                  }}
                  className="text-foreground hover:text-foreground/80 transition-colors cursor-text text-sm font-medium"
                >
                  {canvasName}
                </button>
              )}
              <span className="text-xs">{formatSaveStatus()}</span>
            </div>
          </>
        ) : (
          breadcrumbs.length > 0 && (
            <>
              <span className="text-border">/</span>
              <Breadcrumbs items={breadcrumbs} />
            </>
          )
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search (dashboard mode only) */}
        {mode === 'dashboard' && onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-48 h-8 pl-9 pr-4 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring"
            />
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
                className="h-8 bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground gap-1.5"
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
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                  <button
                    onClick={() => {
                      onExportJSON?.();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
                  >
                    <FileJson className="h-4 w-4" />
                    Export as JSON
                  </button>
                  <button
                    onClick={() => {
                      onExportPNG?.();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
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
              className="h-8 bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground gap-2"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </>
        )}

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
          A
        </div>
      </div>
    </header>
  );
}
