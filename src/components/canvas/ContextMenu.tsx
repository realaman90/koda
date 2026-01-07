'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useCanvasStore, createImageGeneratorNode, createVideoGeneratorNode, createTextNode, createMediaNode } from '@/stores/canvas-store';
import { useReactFlow } from '@xyflow/react';
import {
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  Copy as Duplicate,
  Settings,
  Search,
  Upload,
  Image as ImageIcon,
  Type,
  Video,
  Sparkles,
  Wand2,
  StickyNote,
  Smile,
  Group,
  Sparkle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  action: () => void;
  keywords?: string[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  collapsible?: boolean;
}

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
  const nodes = useCanvasStore((state) => state.nodes);

  const { screenToFlowPosition } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [utilitiesExpanded, setUtilitiesExpanded] = useState(false);

  // Focus search input when menu opens
  useEffect(() => {
    if (contextMenu && contextMenu.type === 'canvas') {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    setSearchQuery('');
    setUtilitiesExpanded(false);
  }, [contextMenu]);

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

  const getNodePosition = () => {
    if (!contextMenu) return { x: 0, y: 0 };
    return screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
  };

  const handleAddNode = (creator: (pos: { x: number; y: number }, name?: string) => ReturnType<typeof createImageGeneratorNode>, baseName: string) => {
    const position = getNodePosition();
    const count = nodes.filter((n) => n.type === creator({x:0,y:0}).type).length + 1;
    const node = creator(position, `${baseName} ${count}`);
    addNode(node);
    hideContextMenu();
  };

  const handleUpload = () => {
    // Create file input and trigger click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const position = getNodePosition();
        Array.from(files).forEach((file, index) => {
          const url = URL.createObjectURL(file);
          const isVideo = file.type.startsWith('video/');
          const node = createMediaNode({ x: position.x + index * 50, y: position.y + index * 50 });
          node.data = { ...node.data, url, type: isVideo ? 'video' : 'image' };
          addNode(node);
        });
      }
    };
    input.click();
    hideContextMenu();
  };

  // Node menu items
  const nodeMenuItems = useMemo(() => contextMenu?.type === 'node' ? [
    { id: 'copy', icon: <Copy className="h-4 w-4" />, label: 'Copy', shortcut: '⌘C', action: copySelected, disabled: selectedNodeIds.length === 0 },
    { id: 'cut', icon: <Scissors className="h-4 w-4" />, label: 'Cut', shortcut: '⌘X', action: cutSelected, disabled: selectedNodeIds.length === 0 },
    { id: 'duplicate', icon: <Duplicate className="h-4 w-4" />, label: 'Duplicate', shortcut: '⌘D', action: duplicateSelected, disabled: selectedNodeIds.length === 0 },
    { id: 'divider1', divider: true },
    { id: 'settings', icon: <Settings className="h-4 w-4" />, label: 'Settings', action: () => selectedNodeIds[0] && openSettingsPanel(selectedNodeIds[0], { x: contextMenu.x + 10, y: contextMenu.y }), disabled: selectedNodeIds.length !== 1 },
    { id: 'divider2', divider: true },
    { id: 'delete', icon: <Trash2 className="h-4 w-4" />, label: 'Delete', shortcut: '⌫', action: deleteSelected, disabled: selectedNodeIds.length === 0, danger: true },
  ] : [], [contextMenu, copySelected, cutSelected, duplicateSelected, deleteSelected, openSettingsPanel, selectedNodeIds]);

  // Canvas menu sections
  const canvasMenuSections: MenuSection[] = useMemo(() => [
    {
      title: '',
      items: [
        {
          id: 'upload',
          icon: <Upload className="h-4 w-4" />,
          label: 'Upload',
          action: handleUpload,
          keywords: ['upload', 'file', 'import'],
        },
        {
          id: 'media',
          icon: <ImageIcon className="h-4 w-4" />,
          label: 'Media',
          action: () => {
            const position = getNodePosition();
            addNode(createMediaNode(position));
            hideContextMenu();
          },
          keywords: ['media', 'image', 'photo', 'picture'],
        },
      ],
    },
    {
      title: 'NODES',
      items: [
        {
          id: 'text',
          icon: <Type className="h-4 w-4 text-zinc-400" />,
          label: 'Text',
          action: () => handleAddNode(createTextNode as any, 'Text'),
          keywords: ['text', 'prompt', 'write'],
        },
        {
          id: 'imageGenerator',
          icon: (
            <div className="relative h-4 w-4">
              <ImageIcon className="h-4 w-4 text-emerald-400" />
              <Sparkle className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-emerald-400 text-emerald-400" />
            </div>
          ),
          label: 'Image Generator',
          action: () => handleAddNode(createImageGeneratorNode, 'Image Generator'),
          keywords: ['image', 'generate', 'ai', 'picture', 'create'],
        },
        {
          id: 'videoGenerator',
          icon: <Video className="h-4 w-4 text-zinc-400" />,
          label: 'Video Generator',
          action: () => handleAddNode(createVideoGeneratorNode, 'Video Generator'),
          keywords: ['video', 'generate', 'ai', 'movie', 'clip'],
        },
        {
          id: 'assistant',
          icon: <Sparkles className="h-4 w-4 text-purple-400" />,
          label: 'Assistant',
          action: () => {
            // TODO: Add assistant node
            hideContextMenu();
          },
          keywords: ['assistant', 'ai', 'chat', 'help'],
        },
        {
          id: 'upscaler',
          icon: <Wand2 className="h-4 w-4 text-zinc-400" />,
          label: 'Image Upscaler',
          action: () => {
            // TODO: Add upscaler node
            hideContextMenu();
          },
          keywords: ['upscale', 'enhance', 'quality', 'resolution'],
        },
      ],
    },
    {
      title: 'UTILITIES',
      collapsible: true,
      items: [
        {
          id: 'stickyNote',
          icon: <StickyNote className="h-4 w-4 text-yellow-400" />,
          label: 'Sticky note',
          action: () => {
            // TODO: Add sticky note node
            hideContextMenu();
          },
          keywords: ['sticky', 'note', 'comment', 'annotation'],
        },
        {
          id: 'stickers',
          icon: <Smile className="h-4 w-4 text-zinc-400" />,
          label: 'Stickers',
          action: () => {
            // TODO: Add stickers
            hideContextMenu();
          },
          keywords: ['sticker', 'emoji', 'icon'],
        },
        {
          id: 'group',
          icon: <Group className="h-4 w-4 text-zinc-400" />,
          label: 'Group',
          action: () => {
            // TODO: Add group functionality
            hideContextMenu();
          },
          keywords: ['group', 'container', 'organize'],
        },
      ],
    },
  ], [addNode, hideContextMenu, handleUpload, nodes]);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return canvasMenuSections;

    const query = searchQuery.toLowerCase();
    return canvasMenuSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.keywords?.some((k) => k.includes(query))
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery, canvasMenuSections]);

  if (!contextMenu) return null;

  // Node context menu (copy, cut, delete, etc.)
  if (contextMenu.type === 'node') {
    return (
      <div
        ref={menuRef}
        className="fixed z-[100] min-w-[180px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {nodeMenuItems.map((item) => {
          if ('divider' in item && item.divider) {
            return <div key={item.id} className="my-1 border-t border-zinc-700" />;
          }

          const isDisabled = 'disabled' in item && item.disabled;
          const isDanger = 'danger' in item && item.danger;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && item.action && item.action()}
              disabled={isDisabled}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-sm cursor-pointer
                ${isDisabled
                  ? 'text-zinc-600 cursor-not-allowed'
                  : isDanger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }
                transition-colors
              `}
            >
              {item.icon}
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

  // Canvas context menu (add nodes)
  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-[220px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {/* Search Input */}
      <div className="p-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 rounded-lg">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      {/* Paste option if clipboard has content */}
      {clipboard && clipboard.nodes.length > 0 && !searchQuery && (
        <div className="border-b border-zinc-800">
          <button
            onClick={() => {
              const position = getNodePosition();
              paste(position);
              hideContextMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <ClipboardPaste className="h-4 w-4" />
            <span className="flex-1 text-left">Paste</span>
            <span className="text-xs text-zinc-500">⌘V</span>
          </button>
        </div>
      )}

      {/* Menu Sections */}
      <div className="py-1 max-h-[400px] overflow-y-auto">
        {filteredSections.map((section, sectionIndex) => {
          const isUtilities = section.title === 'UTILITIES';
          const shouldShowItems = !isUtilities || utilitiesExpanded || searchQuery;

          return (
            <div key={section.title || sectionIndex}>
              {section.title && (
                <div
                  className={`px-4 py-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider flex items-center justify-between ${isUtilities ? 'cursor-pointer hover:bg-zinc-800/50' : ''}`}
                  onClick={() => isUtilities && setUtilitiesExpanded(!utilitiesExpanded)}
                >
                  {section.title}
                  {isUtilities && !searchQuery && (
                    utilitiesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              )}
              {shouldShowItems && section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="px-4 py-6 text-sm text-zinc-500 text-center">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
