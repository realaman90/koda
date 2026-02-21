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
import type { AgentPlugin } from '@/lib/plugins/types';

interface PluginLauncherProps {
  onLaunch: (pluginId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function getLaunchMode(plugin: AgentPlugin): 'Node' | 'Modal' {
  if (plugin.rendering?.mode === 'node') return 'Node';
  if (plugin.rendering?.mode === 'modal') return 'Modal';
  if (plugin.sandbox && !plugin.rendering?.mode) return 'Modal';
  return 'Node';
}

function getIoHint(plugin: AgentPlugin): string | null {
  if (!plugin.handles) return null;
  const inputTypes = plugin.handles.inputs.map((h) => h.type).join(', ');
  const outputTypes = plugin.handles.outputs.map((h) => h.type).join(', ');
  if (!inputTypes && !outputTypes) return null;
  if (!inputTypes) return `Output: ${outputTypes}`;
  if (!outputTypes) return `Input: ${inputTypes}`;
  return `In: ${inputTypes} · Out: ${outputTypes}`;
}

export function PluginLauncher({
  onLaunch,
  isOpen,
  onClose,
  anchorRef,
}: PluginLauncherProps) {
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: -9999, left: -9999 });

  const plugins = React.useMemo(() => pluginRegistry.getAll(), []);

  React.useEffect(() => {
    if (isOpen && anchorRef.current) {
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

  React.useEffect(() => {
    if (!isOpen) setPosition({ top: -9999, left: -9999 });
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePluginClick = (pluginId: string) => {
    onLaunch(pluginId);
    onClose();
  };

  if (plugins.length === 0) {
    return (
      <div
        ref={dropdownRef}
        style={{ top: position.top, left: position.left, visibility: position.top === -9999 ? 'hidden' : 'visible' }}
        className="fixed z-[200] w-[320px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
      >
        <div className="p-4 text-center">
          <Puzzle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No plugins available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      style={{ top: position.top, left: position.left, visibility: position.top === -9999 ? 'hidden' : 'visible' }}
      className="fixed z-[200] w-[320px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-sm font-medium text-foreground">Plugins</h3>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {plugins.map((plugin) => {
          const mode = getLaunchMode(plugin);
          const ioHint = getIoHint(plugin);

          return (
            <button
              key={plugin.id}
              onClick={() => handlePluginClick(plugin.id)}
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <div className="flex items-start gap-3">
                <plugin.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-foreground">{plugin.name}</div>
                    <span className="rounded bg-[#3b82f6]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#3b82f6]">
                      {mode}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{plugin.description}</div>
                  {ioHint && <div className="truncate text-[11px] text-muted-foreground/90">{ioHint}</div>}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
