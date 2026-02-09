'use client';

/**
 * Plugin Launcher Component
 *
 * Dropdown menu showing available plugins.
 * Click a plugin to launch its sandbox.
 */

import * as React from 'react';
import { Puzzle, ChevronRight } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin, PluginCategory } from '@/lib/plugins/types';

// Category labels for display
const CATEGORY_LABELS: Record<PluginCategory, string> = {
  planning: 'Planning',
  brand: 'Brand',
  adaptation: 'Adaptation',
  analysis: 'Analysis',
  text: 'Text',
  enhancement: 'Enhancement',
  automation: 'Automation',
  export: 'Export',
};

interface PluginLauncherProps {
  onLaunch: (pluginId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * Plugin Launcher Dropdown
 */
export function PluginLauncher({
  onLaunch,
  isOpen,
  onClose,
  anchorRef,
}: PluginLauncherProps) {
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: -9999, left: -9999 });

  // Get all plugins from registry
  const plugins = React.useMemo(() => pluginRegistry.getAll(), []);

  // Group plugins by category
  const pluginsByCategory = React.useMemo(() => {
    const grouped: Partial<Record<PluginCategory, AgentPlugin[]>> = {};
    plugins.forEach((plugin) => {
      if (!grouped[plugin.category]) {
        grouped[plugin.category] = [];
      }
      grouped[plugin.category]!.push(plugin);
    });
    return grouped;
  }, [plugins]);

  // Position dropdown near anchor, clamped to viewport
  React.useEffect(() => {
    if (isOpen && anchorRef.current) {
      // Wait a frame so the dropdown renders and we can measure it
      requestAnimationFrame(() => {
        const anchorRect = anchorRef.current?.getBoundingClientRect();
        const dropRect = dropdownRef.current?.getBoundingClientRect();
        if (!anchorRect) return;
        const pad = 8;
        let top = anchorRect.bottom + 8;
        const left = anchorRect.right + 8;
        if (dropRect && top + dropRect.height > window.innerHeight - pad) {
          top = window.innerHeight - dropRect.height - pad;
        }
        top = Math.max(pad, top);
        setPosition({ top, left });
      });
    }
  }, [isOpen, anchorRef]);

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  // Reset position when closed
  React.useEffect(() => {
    if (!isOpen) setPosition({ top: -9999, left: -9999 });
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePluginClick = (pluginId: string) => {
    onLaunch(pluginId);
    onClose();
  };

  // No plugins available
  if (plugins.length === 0) {
    return (
      <div
        ref={dropdownRef}
        style={{ top: position.top, left: position.left, visibility: position.top === -9999 ? 'hidden' : 'visible' }}
        className="fixed z-[200] w-[280px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
      >
        <div className="p-4 text-center">
          <Puzzle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No plugins available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      style={{ top: position.top, left: position.left, visibility: position.top === -9999 ? 'hidden' : 'visible' }}
      className="fixed z-[200] w-[280px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-300">Plugins</h3>
      </div>

      {/* Plugin list */}
      <div className="max-h-[320px] overflow-y-auto">
        {Object.entries(pluginsByCategory).map(([category, categoryPlugins]) => (
          <div key={category}>
            {/* Category header */}
            <div className="px-3 py-1.5 bg-zinc-800/50">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {CATEGORY_LABELS[category as PluginCategory]}
              </span>
            </div>

            {/* Plugins in category */}
            {categoryPlugins?.map((plugin) => (
              <button
                key={plugin.id}
                onClick={() => handlePluginClick(plugin.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
              >
                <span className="text-xl">{plugin.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-200">
                    {plugin.name}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {plugin.description}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
