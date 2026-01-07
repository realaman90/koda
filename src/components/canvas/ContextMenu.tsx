'use client';

import { useEffect, useRef } from 'react';
import { useCanvasStore, createImageGeneratorNode, createTextNode, createMediaNode } from '@/stores/canvas-store';
import { useReactFlow } from '@xyflow/react';
import {
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  Copy as Duplicate,
  Settings,
  ImageIcon,
  Type,
  Film,
} from 'lucide-react';

export function ContextMenu() {
  const contextMenu = useCanvasStore((state) => state.contextMenu);
  const hideContextMenu = useCanvasStore((state) => state.hideContextMenu);
  const copySelected = useCanvasStore((state) => state.copySelected);
  const cutSelected = useCanvasStore((state) => state.cutSelected);
  const paste = useCanvasStore((state) => state.paste);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const addNode = useCanvasStore((state) => state.addNode);
  const clipboard = useCanvasStore((state) => state.clipboard);

  const { screenToFlowPosition } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [hideContextMenu]);

  if (!contextMenu) return null;

  const handleAction = (action: () => void) => {
    action();
    hideContextMenu();
  };

  const handleAddNode = (type: 'imageGenerator' | 'text' | 'media') => {
    const position = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });

    let node;
    switch (type) {
      case 'imageGenerator':
        node = createImageGeneratorNode(position);
        break;
      case 'text':
        node = createTextNode(position);
        break;
      case 'media':
        node = createMediaNode(position);
        break;
    }

    addNode(node);
    hideContextMenu();
  };

  const menuItems = contextMenu.type === 'node' ? [
    { icon: Copy, label: 'Copy', shortcut: '⌘C', action: copySelected, disabled: selectedNodeIds.length === 0 },
    { icon: Scissors, label: 'Cut', shortcut: '⌘X', action: cutSelected, disabled: selectedNodeIds.length === 0 },
    { icon: Duplicate, label: 'Duplicate', shortcut: '⌘D', action: duplicateSelected, disabled: selectedNodeIds.length === 0 },
    { divider: true },
    { icon: Settings, label: 'Settings', action: () => selectedNodeIds[0] && openSettingsPanel(selectedNodeIds[0], { x: contextMenu.x + 10, y: contextMenu.y }), disabled: selectedNodeIds.length !== 1 },
    { divider: true },
    { icon: Trash2, label: 'Delete', shortcut: '⌫', action: deleteSelected, disabled: selectedNodeIds.length === 0, danger: true },
  ] : [
    { icon: ClipboardPaste, label: 'Paste', shortcut: '⌘V', action: () => {
      const position = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
      paste(position);
    }, disabled: !clipboard || clipboard.nodes.length === 0 },
    { divider: true },
    { icon: ImageIcon, label: 'Add Image Generator', action: () => handleAddNode('imageGenerator') },
    { icon: Type, label: 'Add Text Node', action: () => handleAddNode('text') },
    { icon: Film, label: 'Add Media Node', action: () => handleAddNode('media') },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
    >
      {menuItems.map((item, index) => {
        if ('divider' in item && item.divider) {
          return <div key={index} className="my-1 border-t border-zinc-700" />;
        }

        const Icon = item.icon;
        const isDisabled = 'disabled' in item && item.disabled;
        const isDanger = 'danger' in item && item.danger;

        return (
          <button
            key={index}
            onClick={() => !isDisabled && item.action && handleAction(item.action)}
            disabled={isDisabled}
            className={`
              w-full flex items-center gap-3 px-3 py-2 text-sm
              ${isDisabled
                ? 'text-zinc-600 cursor-not-allowed'
                : isDanger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }
              transition-colors
            `}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span className="flex-1 text-left">{item.label}</span>
            {'shortcut' in item && item.shortcut && (
              <span className="text-xs text-zinc-500">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
