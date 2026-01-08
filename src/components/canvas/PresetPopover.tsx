'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Ban, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PresetOption } from '@/lib/types';

interface PresetPopoverProps {
  title: string;
  icon: React.ReactNode;
  presets: PresetOption[];
  selected: PresetOption | null;
  onSelect: (preset: PresetOption | null) => void;
  // For character: allow custom upload
  allowCustomUpload?: boolean;
  customImage?: string;
  onCustomUpload?: (file: File) => void;
  onClearCustom?: () => void;
}

export function PresetPopover({
  title,
  icon,
  presets,
  selected,
  onSelect,
  allowCustomUpload = false,
  customImage,
  onCustomUpload,
  onClearCustom,
}: PresetPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update position when opening
  React.useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = 350;

      let left = rect.left;
      let top = rect.bottom + 8;

      // Adjust if too close to right edge
      if (left + popoverWidth > window.innerWidth - 20) {
        left = window.innerWidth - popoverWidth - 20;
      }

      // Adjust if too close to bottom
      if (top + popoverHeight > window.innerHeight - 20) {
        top = rect.top - popoverHeight - 8;
      }

      setPosition({ top, left });
    }
  }, [open]);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCustomUpload) {
      onCustomUpload(file);
      setOpen(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (preset: PresetOption | null) => {
    onSelect(preset);
    setOpen(false);
  };

  // Check if we have any selection (preset or custom)
  const hasSelection = selected || customImage;

  const popover = open ? (
    <div
      ref={popoverRef}
      className="fixed z-[300] w-[280px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">{icon}</span>
          <span className="text-sm font-medium text-zinc-200">{title}</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="p-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
        <div className="grid grid-cols-3 gap-2">
          {/* None option */}
          <button
            onClick={() => handleSelectPreset(null)}
            className={cn(
              'relative aspect-square rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1',
              !hasSelection
                ? 'border-teal-500 bg-teal-500/10'
                : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
            )}
          >
            <Ban className="h-5 w-5 text-zinc-400" />
            <span className="text-[10px] text-zinc-400">None</span>
            {!hasSelection && (
              <div className="absolute top-1 right-1 bg-teal-500 rounded-full p-0.5">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </button>

          {/* Custom upload for characters */}
          {allowCustomUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative aspect-square rounded-lg border-2 transition-all overflow-hidden',
                customImage
                  ? 'border-teal-500'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              )}
            >
              {customImage ? (
                <>
                  <img
                    src={customImage}
                    alt="Custom"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 bg-teal-500 rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                  {onClearCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearCustom();
                      }}
                      className="absolute top-1 left-1 bg-red-500 rounded-full p-0.5 hover:bg-red-400"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <Upload className="h-5 w-5 text-zinc-400" />
                  <span className="text-[10px] text-zinc-400">Custom</span>
                </div>
              )}
            </button>
          )}

          {/* Preset options */}
          {presets.map((preset) => {
            // Derive actual image path from SVG path (replace .svg with .jpg for actual images)
            const actualImagePath = preset.preview.replace('.svg', '.jpg');

            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'relative aspect-square rounded-lg border-2 transition-all overflow-hidden group',
                  selected?.id === preset.id
                    ? 'border-teal-500'
                    : 'border-zinc-700 hover:border-zinc-600'
                )}
              >
                {/* Actual image (shown on hover) */}
                <img
                  src={actualImagePath}
                  alt={preset.label}
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  onError={(e) => {
                    // Hide if actual image doesn't exist
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                {/* SVG overlay (fades on hover when actual image exists) */}
                <img
                  src={preset.preview}
                  alt={preset.label}
                  className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-200"
                  onError={(e) => {
                    // Show placeholder background on error
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.classList.add('bg-zinc-800');
                  }}
                />
                {/* Label overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                  <span className="text-[9px] text-white font-medium truncate block">
                    {preset.label}
                  </span>
                </div>
                {/* Check mark */}
                {selected?.id === preset.id && (
                  <div className="absolute top-1 right-1 bg-teal-500 rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden file input */}
      {allowCustomUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  ) : null;

  // Derive actual image path for trigger button
  const selectedActualImage = selected?.preview.replace('.svg', '.jpg');

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border transition-all cursor-pointer group',
          hasSelection
            ? 'border-teal-500/50 bg-teal-500/10 hover:bg-teal-500/20'
            : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-600'
        )}
      >
        {/* Preview thumbnail or icon */}
        <div className="relative w-8 h-8 rounded overflow-hidden flex items-center justify-center">
          {customImage ? (
            <img
              src={customImage}
              alt="Custom"
              className="w-full h-full object-cover"
            />
          ) : selected ? (
            <>
              {/* Actual image (shown on hover) */}
              <img
                src={selectedActualImage}
                alt={selected.label}
                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              {/* SVG overlay */}
              <img
                src={selected.preview}
                alt={selected.label}
                className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </>
          ) : (
            <span className="text-zinc-400">{icon}</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-400 truncate max-w-full">
          {customImage ? 'Custom' : selected?.label || title}
        </span>
      </button>

      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </>
  );
}
