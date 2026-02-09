'use client';

/**
 * AnimationSettingsPanel
 *
 * Floating settings panel for the AnimationNode.
 * Rendered via createPortal to document.body to avoid React Flow transform clipping.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ImagePlus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Type, Sparkles, Box, BarChart3, Layers, Blend, Zap, Clapperboard, Aperture, SunMoon,
} from 'lucide-react';
import { TECHNIQUE_PRESETS } from '@/mastra/recipes';
import { STYLE_PRESETS, THEME_PRESETS, FONT_OPTIONS, FPS_OPTIONS, RESOLUTION_OPTIONS } from '../presets';
import type { AnimationEngine, AspectRatio, AnimationNodeData } from '../types';

// ─── Icon map for technique presets ────────────────────────────────────
const TECHNIQUE_ICONS: Record<string, LucideIcon> = {
  Type, Sparkles, Box, BarChart3, Layers, Blend, Zap, Clapperboard, Aperture, SunMoon,
};

// ─── Constants ─────────────────────────────────────────────────────────
const ALL_ENGINES: { id: AnimationEngine; label: string }[] = [
  { id: 'remotion', label: 'Remotion' },
  { id: 'theatre', label: 'Theatre.js' },
];

// Theatre.js requires a Docker sandbox (no E2B template yet).
// Hide it when NEXT_PUBLIC_THEATRE_ENABLED is explicitly 'false' or when using E2B without a Theatre template.
const theatreEnabled = process.env.NEXT_PUBLIC_THEATRE_ENABLED !== 'false';
const ENGINES = theatreEnabled ? ALL_ENGINES : ALL_ENGINES.filter((e) => e.id !== 'theatre');

const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
  { id: '21:9', label: '21:9' },
];

const DURATION_MIN = 3;
const DURATION_MAX = 30;

// ─── Props ─────────────────────────────────────────────────────────────
interface AnimationSettingsPanelProps {
  nodeId: string;
  position: { x: number; y: number };
  onClose: () => void;
  engine: AnimationEngine;
  aspectRatio: AspectRatio;
  duration: number;
  techniques: string[];
  designSpec?: AnimationNodeData['designSpec'];
  logo?: AnimationNodeData['logo'];
  fps?: number;
  resolution?: string;
  engineLocked?: boolean;
  onEngineChange: (engine: AnimationEngine) => void;
  onAspectRatioChange: (ar: AspectRatio) => void;
  onDurationChange: (d: number) => void;
  onTechniquesChange: (t: string[]) => void;
  onDesignSpecChange: (spec: AnimationNodeData['designSpec']) => void;
  onLogoChange: (logo: AnimationNodeData['logo']) => void;
  onFpsChange: (fps: number) => void;
  onResolutionChange: (res: string) => void;
}

// ─── Section Label ─────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--an-text-dim)] mb-1.5">
      {children}
    </p>
  );
}

// ─── Select Dropdown ───────────────────────────────────────────────────
function SelectDropdown({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-[var(--an-bg-input)] border border-[var(--an-border-input)] rounded-md px-2.5 py-1.5 pr-7 text-[11px] text-[var(--an-text)] outline-none focus:border-[var(--an-border-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--an-text-dim)] pointer-events-none" />
    </div>
  );
}

// ─── Color Input ───────────────────────────────────────────────────────
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded border border-[var(--an-border-input)] cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          className="flex-1 bg-[var(--an-bg-input)] border border-[var(--an-border-input)] rounded px-2 py-1 text-[10px] text-[var(--an-text)] font-mono outline-none focus:border-[var(--an-border-hover)]"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export function AnimationSettingsPanel({
  nodeId,
  position,
  onClose,
  engine,
  aspectRatio,
  duration,
  techniques,
  designSpec,
  logo,
  fps = 30,
  resolution = '1080p',
  engineLocked,
  onEngineChange,
  onAspectRatioChange,
  onDurationChange,
  onTechniquesChange,
  onDesignSpecChange,
  onLogoChange,
  onFpsChange,
  onResolutionChange,
}: AnimationSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to stay in viewport
  useEffect(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = position;

    // If panel overflows right, show on left of node
    if (x + rect.width > vw - 16) {
      // Shift to left of node: position.x is node.right + 10, so node.right = x - 10
      // We want panel.right = node.left, so x = node.left - panel.width - 10
      // node.left ~= node.right - 400 (node width)
      x = x - 10 - 400 - rect.width - 10;
      if (x < 16) x = 16;
    }
    // Clamp vertical
    if (y + rect.height > vh - 16) {
      y = vh - rect.height - 16;
    }
    if (y < 16) y = 16;

    setAdjustedPosition({ x, y });
  }, [position]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on click outside (exclude Radix portals)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const target = e.target as HTMLElement;
      if (panelRef.current.contains(target)) return;
      // Don't close if clicking inside a Radix dropdown portal
      if (target.closest('[data-radix-popper-content-wrapper]')) return;
      onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // ─── Technique toggle ────────────────────────────────────────────────
  const toggleTechnique = useCallback(
    (id: string) => {
      const next = techniques.includes(id)
        ? techniques.filter((t) => t !== id)
        : [...techniques, id];
      onTechniquesChange(next);
    },
    [techniques, onTechniquesChange]
  );

  // ─── Design spec helpers ─────────────────────────────────────────────
  const colors = designSpec?.colors || { primary: '#09090B', secondary: '#FAFAFA', accent: '#3B82F6' };
  const fonts = designSpec?.fonts || { title: 'Inter', body: 'Inter' };

  const updateColors = useCallback(
    (key: 'primary' | 'secondary' | 'accent', value: string) => {
      onDesignSpecChange({
        ...designSpec,
        colors: { ...colors, [key]: value },
      });
    },
    [designSpec, colors, onDesignSpecChange]
  );

  const updateFonts = useCallback(
    (key: 'title' | 'body', value: string) => {
      onDesignSpecChange({
        ...designSpec,
        fonts: { ...fonts, [key]: value },
      });
    },
    [designSpec, fonts, onDesignSpecChange]
  );

  const selectStylePreset = useCallback(
    (presetId: string) => {
      const preset = STYLE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      // Style sets aesthetic direction + default colors/fonts
      onDesignSpecChange({
        ...designSpec,
        style: preset.id,
        colors: { ...preset.colors },
        fonts: { ...preset.fonts },
      });
    },
    [designSpec, onDesignSpecChange]
  );

  const selectThemePreset = useCallback(
    (presetId: string) => {
      const preset = THEME_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      // Theme overrides colors/fonts without changing style
      onDesignSpecChange({
        ...designSpec,
        theme: presetId,
        colors: { ...preset.colors },
        fonts: { ...preset.fonts },
      });
    },
    [designSpec, onDesignSpecChange]
  );

  // ─── Logo handlers ────────────────────────────────────────────────────
  const handleLogoFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onLogoChange({ url: reader.result as string, name: file.name });
      };
      reader.readAsDataURL(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onLogoChange]
  );

  // ─── Render via portal ───────────────────────────────────────────────
  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[280px] max-h-[560px] flex flex-col rounded-xl overflow-hidden animation-node"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: 'var(--an-bg)',
        border: '1px solid var(--an-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--an-border)] shrink-0">
        <span className="text-[12px] font-semibold text-[var(--an-text-heading)]">Settings</span>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] hover:bg-[var(--an-bg-hover)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-3 space-y-4 scrollbar-hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {/* ── Category (Technique Presets) ────────────────────────────── */}
        <div>
          <SectionLabel>Category</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {TECHNIQUE_PRESETS.map((preset) => {
              const isSelected = techniques.includes(preset.id);
              const Icon = TECHNIQUE_ICONS[preset.icon];
              return (
                <button
                  key={preset.id}
                  onClick={() => toggleTechnique(preset.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                    isSelected
                      ? 'bg-[var(--an-accent-bg)] border-[var(--an-accent)] text-[var(--an-accent-text)]'
                      : 'bg-[var(--an-bg-card)] border-[var(--an-border-input)] text-[var(--an-text-dim)] hover:border-[var(--an-border-hover)] hover:text-[var(--an-text-muted)]'
                  }`}
                  title={preset.description}
                >
                  {Icon && <Icon className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Logo</SectionLabel>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoFileChange}
            className="hidden"
          />
          {logo?.url ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-[var(--an-bg-card)] border border-[var(--an-border-input)]">
              <img
                src={logo.url}
                alt={logo.name || 'Logo'}
                className="w-8 h-8 rounded object-contain bg-white/10"
              />
              <span className="flex-1 text-[10px] text-[var(--an-text-muted)] truncate">
                {logo.name || 'Logo'}
              </span>
              <button
                onClick={() => onLogoChange(undefined)}
                className="w-5 h-5 rounded flex items-center justify-center text-[var(--an-text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove logo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[10px] font-medium border border-dashed border-[var(--an-border-input)] text-[var(--an-text-dim)] hover:border-[var(--an-border-hover)] hover:text-[var(--an-text-muted)] transition-colors"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Upload logo</span>
            </button>
          )}
        </div>

        {/* ── Style Presets (with images) ─────────────────────────────── */}
        <div>
          <SectionLabel>Style</SectionLabel>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden pb-0.5" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            {STYLE_PRESETS.map((preset) => {
              const isSelected = designSpec?.style === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => selectStylePreset(preset.id)}
                  className={`shrink-0 w-[80px] rounded-lg overflow-hidden border transition-all ${
                    isSelected
                      ? 'border-[var(--an-accent)] ring-1 ring-[var(--an-accent)]/30'
                      : 'border-[var(--an-border-input)] hover:border-[var(--an-border-hover)]'
                  }`}
                  title={preset.description}
                >
                  {/* Preview image */}
                  <div className="aspect-square overflow-hidden bg-[var(--an-bg-card)]">
                    <img
                      src={preset.image}
                      alt={preset.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="px-1.5 py-1 bg-[var(--an-bg-card)]">
                    <span className="text-[9px] font-medium text-[var(--an-text-muted)]">
                      {preset.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Theme Presets (color/font combos) ─────────────────────── */}
        <div>
          <SectionLabel>Theme</SectionLabel>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden pb-0.5" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            {THEME_PRESETS.map((preset) => {
              const isSelected = designSpec?.theme === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => selectThemePreset(preset.id)}
                  className={`shrink-0 w-[72px] rounded-md overflow-hidden border transition-all ${
                    isSelected
                      ? 'border-[var(--an-accent)] ring-1 ring-[var(--an-accent)]/30'
                      : 'border-[var(--an-border-input)] hover:border-[var(--an-border-hover)]'
                  }`}
                  title={preset.description}
                >
                  {/* Color bar preview */}
                  <div className="h-5 flex">
                    <div className="flex-1" style={{ backgroundColor: preset.colors.primary }} />
                    <div className="flex-1" style={{ backgroundColor: preset.colors.accent }} />
                    <div className="flex-1" style={{ backgroundColor: preset.colors.secondary }} />
                  </div>
                  <div className="px-1.5 py-1 bg-[var(--an-bg-card)]">
                    <span className="text-[9px] font-medium text-[var(--an-text-muted)]">
                      {preset.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Colors ─────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Colors</SectionLabel>
          <div className="space-y-1.5">
            <ColorInput label="Primary" value={colors.primary} onChange={(v) => updateColors('primary', v)} />
            <ColorInput label="Secondary" value={colors.secondary} onChange={(v) => updateColors('secondary', v)} />
            <ColorInput label="Accent" value={colors.accent || '#3B82F6'} onChange={(v) => updateColors('accent', v)} />
          </div>
        </div>

        {/* ── Fonts ──────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Fonts</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">Title</span>
              <SelectDropdown
                value={fonts.title}
                options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
                onChange={(v) => updateFonts('title', v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">Body</span>
              <SelectDropdown
                value={fonts.body}
                options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
                onChange={(v) => updateFonts('body', v)}
              />
            </div>
          </div>
        </div>

        {/* ── Output Settings ────────────────────────────────────────── */}
        <div>
          <SectionLabel>Output</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">Engine</span>
              <SelectDropdown
                value={engine}
                options={ENGINES.map((e) => ({ value: e.id, label: e.label }))}
                onChange={(v) => onEngineChange(v as AnimationEngine)}
                disabled={engineLocked}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">Ratio</span>
              <SelectDropdown
                value={aspectRatio}
                options={ASPECT_RATIOS.map((a) => ({ value: a.id, label: a.label }))}
                onChange={(v) => onAspectRatioChange(v as AspectRatio)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">Duration</span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={1}
                  value={Math.min(duration, DURATION_MAX)}
                  onChange={(e) => onDurationChange(Number(e.target.value))}
                  className="flex-1 h-1.5 cursor-pointer rounded-full appearance-none bg-[var(--an-border-input)] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[var(--an-border-input)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--an-accent)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:-mt-[3px] [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--an-bg)]"
                />
                <span className="text-[11px] font-mono text-[var(--an-text-muted)] w-7 text-right tabular-nums">
                  {Math.min(duration, DURATION_MAX)}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">FPS</span>
              <SelectDropdown
                value={fps}
                options={FPS_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
                onChange={(v) => onFpsChange(Number(v))}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--an-text-muted)] w-16 shrink-0">Quality</span>
              <SelectDropdown
                value={resolution}
                options={RESOLUTION_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                onChange={(v) => onResolutionChange(v)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
