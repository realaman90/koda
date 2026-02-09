'use client';

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { useCanvasStore, createImageGeneratorNode, createVideoGeneratorNode, createTextNode, createMediaNode, createStickyNoteNode, createStickerNode, createGroupNode, createMusicGeneratorNode, createSpeechNode, createVideoAudioNode, createPluginNode } from '@/stores/canvas-store';
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
  StickyNote,
  Smile,
  Group,
  Sparkle,
  ChevronDown,
  ChevronUp,
  Puzzle,
  Music,
  Mic,
  Film,
  Clapperboard,
} from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import { uploadAsset } from '@/lib/assets/upload';
// Import official plugins to register them
import '@/lib/plugins/official/storyboard-generator';
import '@/lib/plugins/official/product-shot';
import '@/lib/plugins/official/agents/animation-generator';

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

interface ContextMenuProps {
  onPluginLaunch?: (pluginId: string) => void;
}

export function ContextMenu({ onPluginLaunch }: ContextMenuProps) {
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
  const groupSelected = useCanvasStore((state) => state.groupSelected);
  const clipboard = useCanvasStore((state) => state.clipboard);
  const nodes = useCanvasStore((state) => state.nodes);

  const { screenToFlowPosition } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [utilitiesExpanded, setUtilitiesExpanded] = useState(false);
  const [pluginsExpanded, setPluginsExpanded] = useState(false);

  // Clamp menu position so it doesn't overflow the viewport
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextMenu) {
      setMenuPos(null);
      return;
    }
    // Defer one frame so the ref is attached after render
    const raf = requestAnimationFrame(() => {
      const el = menuRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pad = 8;
      const x = Math.min(contextMenu.x, window.innerWidth - rect.width - pad);
      const y = Math.min(contextMenu.y, window.innerHeight - rect.height - pad);
      setMenuPos({ x: Math.max(pad, x), y: Math.max(pad, y) });
    });
    return () => cancelAnimationFrame(raf);
  }, [contextMenu]);

  // Focus search input when menu opens
  useEffect(() => {
    if (contextMenu && contextMenu.type === 'canvas') {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    setSearchQuery('');
    setUtilitiesExpanded(false);
    setPluginsExpanded(false);
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const position = getNodePosition();
        Array.from(files).forEach(async (file, index) => {
          const isVideo = file.type.startsWith('video/');
          const node = createMediaNode({ x: position.x + index * 50, y: position.y + index * 50 });
          try {
            const asset = await uploadAsset(file, { nodeId: node.id });
            node.data = { ...node.data, url: asset.url, type: isVideo ? 'video' : 'image' };
            addNode(node);
          } catch (err) {
            console.error('[ContextMenu] Upload failed:', err);
          }
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
    { id: 'group', icon: <Group className="h-4 w-4" />, label: 'Group Selected', shortcut: '⌘G', action: () => { groupSelected(); hideContextMenu(); }, disabled: selectedNodeIds.length < 2 },
    { id: 'divider1', divider: true },
    { id: 'settings', icon: <Settings className="h-4 w-4" />, label: 'Settings', action: () => selectedNodeIds[0] && openSettingsPanel(selectedNodeIds[0], { x: contextMenu.x + 10, y: contextMenu.y }), disabled: selectedNodeIds.length !== 1 },
    { id: 'divider2', divider: true },
    { id: 'delete', icon: <Trash2 className="h-4 w-4" />, label: 'Delete', shortcut: '⌫', action: deleteSelected, disabled: selectedNodeIds.length === 0, danger: true },
  ] : [], [contextMenu, copySelected, cutSelected, duplicateSelected, groupSelected, deleteSelected, hideContextMenu, openSettingsPanel, selectedNodeIds]);

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
          icon: <Video className="h-4 w-4 text-blue-400" />,
          label: 'Video Generator',
          action: () => handleAddNode(createVideoGeneratorNode, 'Video Generator'),
          keywords: ['video', 'generate', 'ai', 'movie', 'clip'],
        },
        {
          id: 'animationGenerator',
          icon: <Clapperboard className="h-4 w-4 text-blue-500" />,
          label: 'Animation Generator',
          action: () => handleAddNode(
            (pos, name) => createPluginNode(pos, 'animation-generator', name),
            'Animation Generator'
          ),
          keywords: ['animation', 'animate', 'motion', 'theatre', 'theater'],
        },
      ],
    },
    {
      title: 'AUDIO',
      items: [
        {
          id: 'musicGenerator',
          icon: <Music className="h-4 w-4 text-orange-400" />,
          label: 'Music Generator',
          action: () => handleAddNode(createMusicGeneratorNode, 'Music Generator'),
          keywords: ['music', 'audio', 'sound', 'song', 'generate'],
        },
        {
          id: 'speech',
          icon: <Mic className="h-4 w-4 text-cyan-400" />,
          label: 'Speech',
          action: () => handleAddNode(createSpeechNode, 'Speech'),
          keywords: ['speech', 'voice', 'tts', 'text-to-speech', 'narration'],
        },
        {
          id: 'videoAudio',
          icon: <Film className="h-4 w-4 text-pink-400" />,
          label: 'Video Audio',
          action: () => handleAddNode(createVideoAudioNode, 'Video Audio'),
          keywords: ['video', 'audio', 'sync', 'sound', 'foley'],
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
            const position = getNodePosition();
            addNode(createStickyNoteNode(position));
            hideContextMenu();
          },
          keywords: ['sticky', 'note', 'comment', 'annotation'],
        },
        {
          id: 'stickers',
          icon: <Smile className="h-4 w-4 text-zinc-400" />,
          label: 'Sticker',
          action: () => {
            const position = getNodePosition();
            addNode(createStickerNode(position));
            hideContextMenu();
          },
          keywords: ['sticker', 'emoji', 'icon'],
        },
        {
          id: 'group',
          icon: <Group className="h-4 w-4 text-indigo-400" />,
          label: 'Group',
          action: () => {
            const position = getNodePosition();
            const count = nodes.filter((n) => n.type === 'group').length + 1;
            addNode(createGroupNode(position, `Group ${count}`));
            hideContextMenu();
          },
          keywords: ['group', 'container', 'organize'],
        },
      ],
    },
    {
      title: 'PLUGINS',
      collapsible: true,
      items: pluginRegistry.getAll().map((plugin) => ({
        id: plugin.id,
        icon: <plugin.icon className="w-4 h-4" />,
        label: plugin.name,
        action: () => {
          if (onPluginLaunch) {
            onPluginLaunch(plugin.id);
          }
          hideContextMenu();
        },
        keywords: [plugin.name.toLowerCase(), plugin.category, 'plugin'],
      })),
    },
  ], [addNode, hideContextMenu, handleUpload, nodes, onPluginLaunch]);

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
        className="fixed z-[100] min-w-[180px] bg-popover border border-border rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 overflow-y-auto"
        style={{
          left: menuPos?.x ?? -9999,
          top: menuPos?.y ?? -9999,
          maxHeight: menuPos ? `calc(100vh - ${menuPos.y}px - 8px)` : undefined,
          visibility: menuPos ? 'visible' : 'hidden',
        }}
      >
        {nodeMenuItems.map((item) => {
          if ('divider' in item && item.divider) {
            return <div key={item.id} className="my-1 border-t border-border" />;
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
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : isDanger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-foreground hover:bg-muted'
                }
                transition-colors
              `}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {'shortcut' in item && item.shortcut && (
                <span className="text-xs text-muted-foreground">{item.shortcut}</span>
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
      className="fixed z-[100] w-[220px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      style={{
        left: menuPos?.x ?? -9999,
        top: menuPos?.y ?? -9999,
        maxHeight: menuPos ? `calc(100vh - ${menuPos.y}px - 8px)` : undefined,
        visibility: menuPos ? 'visible' : 'hidden',
      }}
    >
      {/* Search Input */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-lg">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Paste option if clipboard has content */}
      {clipboard && clipboard.nodes.length > 0 && !searchQuery && (
        <div className="border-b border-border">
          <button
            onClick={() => {
              const position = getNodePosition();
              paste(position);
              hideContextMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <ClipboardPaste className="h-4 w-4" />
            <span className="flex-1 text-left">Paste</span>
            <span className="text-xs text-muted-foreground">⌘V</span>
          </button>
        </div>
      )}

      {/* Menu Sections */}
      <div className="py-1 min-h-0 flex-1 overflow-y-auto">
        {filteredSections.map((section, sectionIndex) => {
          const isUtilities = section.title === 'UTILITIES';
          const isPlugins = section.title === 'PLUGINS';
          const isCollapsible = isUtilities || isPlugins;
          const isExpanded = isUtilities ? utilitiesExpanded : isPlugins ? pluginsExpanded : true;
          const shouldShowItems = !isCollapsible || isExpanded || searchQuery;

          // Skip plugins section if no plugins available
          if (isPlugins && section.items.length === 0) return null;

          return (
            <div key={section.title || sectionIndex}>
              {section.title && (
                <div
                  className={`px-4 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between ${isCollapsible ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  onClick={() => {
                    if (isUtilities) setUtilitiesExpanded(!utilitiesExpanded);
                    if (isPlugins) setPluginsExpanded(!pluginsExpanded);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    {isPlugins && <Puzzle className="h-3 w-3" />}
                    {section.title}
                  </span>
                  {isCollapsible && !searchQuery && (
                    isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              )}
              {shouldShowItems && section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
