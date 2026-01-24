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
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Close on escape key and prevent body scroll
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  // Check if we have any selection (preset or custom)
  const hasSelection = selected || customImage;

  const modal = open ? (
    <div
      data-preset-modal="true"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-[90vw] max-w-[480px] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">{icon}</span>
            <span className="text-base font-medium text-zinc-200">{title}</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-3 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
          <div className="grid grid-cols-4 gap-2">
            {/* None option */}
            <button
              onClick={() => handleSelectPreset(null)}
              className={cn(
                'relative aspect-square rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1',
                !hasSelection
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              )}
            >
              <Ban className="h-6 w-6 text-zinc-400" />
              <span className="text-xs text-zinc-400">None</span>
              {!hasSelection && (
                <div className="absolute top-1.5 right-1.5 bg-teal-500 rounded-full p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>

            {/* Custom upload for characters */}
            {allowCustomUpload && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative aspect-square rounded-xl border-2 transition-all overflow-hidden',
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
                    <div className="absolute top-1.5 right-1.5 bg-teal-500 rounded-full p-0.5">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    {onClearCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearCustom();
                        }}
                        className="absolute top-1.5 left-1.5 bg-red-500 rounded-full p-0.5 hover:bg-red-400"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <Upload className="h-6 w-6 text-zinc-400" />
                    <span className="text-xs text-zinc-400">Custom</span>
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
                    'relative aspect-square rounded-xl border-2 transition-all overflow-hidden group',
                    selected?.id === preset.id
                      ? 'border-teal-500'
                      : 'border-zinc-700 hover:border-zinc-600'
                  )}
                >
                  {/* Actual image (base layer, always visible) */}
                  <img
                    src={actualImagePath}
                    alt={preset.label}
                    className="absolute inset-0 w-full h-full object-cover z-[1]"
                    onError={(e) => {
                      // Hide if actual image doesn't exist
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {/* SVG overlay (on top with low opacity, fades more on hover) */}
                  <img
                    src={preset.preview}
                    alt={preset.label}
                    className="absolute inset-0 w-full h-full object-cover z-[2] opacity-40 group-hover:opacity-0 transition-opacity duration-200"
                    onError={(e) => {
                      // Hide SVG on error
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {/* Label overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5 z-[3]">
                    <span className="text-[10px] text-white font-medium truncate block">
                      {preset.label}
                    </span>
                  </div>
                  {/* Check mark */}
                  {selected?.id === preset.id && (
                    <div className="absolute top-1.5 right-1.5 bg-teal-500 rounded-full p-0.5 z-[4]">
                      <Check className="h-3 w-3 text-white" />
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
              {/* Actual image (base layer, always visible) */}
              <img
                src={selectedActualImage}
                alt={selected.label}
                className="absolute inset-0 w-full h-full object-cover z-[1]"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              {/* SVG overlay (on top with low opacity, fades on hover) */}
              <img
                src={selected.preview}
                alt={selected.label}
                className="absolute inset-0 w-full h-full object-cover z-[2] opacity-40 group-hover:opacity-0 transition-opacity duration-200"
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

      {typeof document !== 'undefined' && createPortal(modal, document.body)}
    </>
  );
}
