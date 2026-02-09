'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  useCanvasStore,
  createImageGeneratorNode,
  createVideoGeneratorNode,
  createTextNode,
  createMediaNode,
  createStickyNoteNode,
  createStickerNode,
  createGroupNode,
  createMusicGeneratorNode,
  createSpeechNode,
  createVideoAudioNode,
  createPluginNode,
} from '@/stores/canvas-store';
import {
  Plus,
  Hand,
  Undo2,
  Redo2,
  Scissors,
  Settings,
  MousePointer2,
  Puzzle,
  Image as ImageIcon,
  Video,
  Type,
  StickyNote,
  Smile,
  Group,
  Sparkle,
  Music,
  Mic,
  Film,
  Clapperboard,
  Search,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PluginLauncher } from '@/components/plugins/PluginLauncher';
import { uploadAsset } from '@/lib/assets/upload';
// Import official plugins to register them
import '@/lib/plugins/official/storyboard-generator';
import '@/lib/plugins/official/product-shot';
import '@/lib/plugins/official/agents/animation-generator';
import '@/lib/plugins/official/agents/motion-analyzer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NodeToolbarProps {
  onPluginLaunch?: (pluginId: string) => void;
}

export function NodeToolbar({ onPluginLaunch }: NodeToolbarProps) {
  const nodes = useCanvasStore((state) => state.nodes);
  const addNode = useCanvasStore((state) => state.addNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);
  const showShortcuts = useCanvasStore((state) => state.showShortcuts);
  const setShowShortcuts = useCanvasStore((state) => state.setShowShortcuts);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const getViewportCenter = useCanvasStore((state) => state.getViewportCenter);

  // Plugin launcher state
  const [showPluginLauncher, setShowPluginLauncher] = useState(false);
  const pluginButtonRef = useRef<HTMLButtonElement>(null);

  // Check if there are any generators with prompts
  const hasRunnableGenerators = nodes.some((n) => {
    if (n.type !== 'imageGenerator') return false;
    const data = n.data as { prompt?: string };
    return !!data.prompt;
  });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [utilitiesExpanded, setUtilitiesExpanded] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addMenuDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [addMenuPosition, setAddMenuPosition] = useState({ x: -9999, y: -9999 });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };

    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when menu opens
      setTimeout(() => searchInputRef.current?.focus(), 50);
      // Position dropdown clamped to viewport
      requestAnimationFrame(() => {
        const btn = addMenuRef.current;
        const dropdown = addMenuDropdownRef.current;
        if (btn && dropdown) {
          const btnRect = btn.getBoundingClientRect();
          const dropRect = dropdown.getBoundingClientRect();
          const pad = 8;
          const x = btnRect.right + 8;
          let y = btnRect.top;
          // Clamp bottom
          if (y + dropRect.height > window.innerHeight - pad) {
            y = window.innerHeight - dropRect.height - pad;
          }
          y = Math.max(pad, y);
          setAddMenuPosition({ x, y });
        }
      });
    } else {
      setSearchQuery('');
      setUtilitiesExpanded(false);
      setAddMenuPosition({ x: -9999, y: -9999 });
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  const handleAddNode = (
    creator: (pos: { x: number; y: number }, name?: string) => ReturnType<typeof createImageGeneratorNode>,
    baseName?: string
  ) => {
    const position = getViewportCenter();
    const nodeType = creator({ x: 0, y: 0 }).type;
    const count = nodes.filter((n) => n.type === nodeType).length + 1;
    const node = baseName ? creator(position, `${baseName} ${count}`) : creator(position);
    addNode(node);
    setShowAddMenu(false);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const position = getViewportCenter();
        Array.from(files).forEach(async (file, index) => {
          const isVideo = file.type.startsWith('video/');
          const node = createMediaNode({ x: position.x + index * 50, y: position.y + index * 50 });
          try {
            // Upload to server-side asset storage (local disk or R2)
            const asset = await uploadAsset(file, { nodeId: node.id });
            node.data = { ...node.data, url: asset.url, type: isVideo ? 'video' : 'image' };
            addNode(node);
          } catch (err) {
            console.error('[NodeToolbar] Upload failed:', err);
          }
        });
      }
    };
    input.click();
    setShowAddMenu(false);
  };

  const addMenuSections = useMemo(() => [
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
          action: () => handleAddNode(createMediaNode as any),
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
          icon: <Video className="h-4 w-4 text-purple-400" />,
          label: 'Video Generator',
          action: () => handleAddNode(createVideoGeneratorNode, 'Video Generator'),
          keywords: ['video', 'generate', 'ai', 'movie', 'clip'],
        },
        {
          id: 'animationGenerator',
          icon: <Clapperboard className="h-4 w-4 text-blue-400" />,
          label: 'Animation Generator',
          action: () => handleAddNode(
            (pos, name) => createPluginNode(pos, 'animation-generator', name),
            'Animation Generator'
          ),
          keywords: ['animation', 'animate', 'motion', 'theatre'],
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
          label: 'Sticky Note',
          action: () => handleAddNode(createStickyNoteNode as any),
          keywords: ['sticky', 'note', 'comment', 'annotation'],
        },
        {
          id: 'sticker',
          icon: <Smile className="h-4 w-4 text-zinc-400" />,
          label: 'Sticker',
          action: () => handleAddNode(createStickerNode as any),
          keywords: ['sticker', 'emoji', 'icon'],
        },
        {
          id: 'group',
          icon: <Group className="h-4 w-4 text-indigo-400" />,
          label: 'Group',
          action: () => handleAddNode(createGroupNode, 'Group'),
          keywords: ['group', 'container', 'organize'],
        },
      ],
    },
  ], []);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return addMenuSections;

    const query = searchQuery.toLowerCase();
    return addMenuSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.keywords?.some((k) => k.includes(query))
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery, addMenuSections]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
        {/* Add Button */}
        <div className="relative" ref={addMenuRef}>
          <div className="bg-popover/95 backdrop-blur border border-border rounded-xl p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className={`
                    h-9 w-9 rounded-lg
                    ${showAddMenu
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
                Add Node
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Add Menu Dropdown */}
          {showAddMenu && (
            <div
              ref={addMenuDropdownRef}
              className="fixed w-[220px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-left-2 duration-150 flex flex-col"
              style={{
                left: addMenuPosition.x,
                top: addMenuPosition.y,
                maxHeight: addMenuPosition.y > 0 ? `calc(100vh - ${addMenuPosition.y}px - 8px)` : undefined,
                visibility: addMenuPosition.x === -9999 ? 'hidden' : 'visible',
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

              {/* Menu Sections */}
              <div className="py-1 min-h-0 flex-1 overflow-y-auto">
                {filteredSections.map((section, sectionIndex) => {
                  const isUtilities = section.title === 'UTILITIES';
                  const isCollapsible = section.collapsible;
                  const isExpanded = isUtilities ? utilitiesExpanded : true;
                  const shouldShowItems = !isCollapsible || isExpanded || searchQuery;

                  return (
                    <div key={section.title || sectionIndex}>
                      {section.title && (
                        <div
                          className={`px-4 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between ${isCollapsible ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                          onClick={() => {
                            if (isUtilities) setUtilitiesExpanded(!utilitiesExpanded);
                          }}
                        >
                          <span>{section.title}</span>
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
          )}
        </div>

        {/* Main Toolbar */}
        <div className="bg-popover/95 backdrop-blur border border-border rounded-xl p-1 flex flex-col gap-0.5">
          {/* Select Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveTool('select')}
                className={`
                  h-9 w-9 rounded-lg relative
                  ${activeTool === 'select'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <MousePointer2 className="h-[18px] w-[18px]" />
                {activeTool === 'select' && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-foreground rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Select (V)
            </TooltipContent>
          </Tooltip>

          {/* Pan Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveTool('pan')}
                className={`
                  h-9 w-9 rounded-lg relative
                  ${activeTool === 'pan'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Hand className="h-[18px] w-[18px]" />
                {activeTool === 'pan' && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-foreground rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Pan (H)
            </TooltipContent>
          </Tooltip>

          {/* Scissors Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveTool('scissors')}
                className={`
                  h-9 w-9 rounded-lg relative
                  ${activeTool === 'scissors'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Scissors className="h-[18px] w-[18px]" />
                {activeTool === 'scissors' && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-foreground rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Scissors (X)
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px bg-border my-1" />

          {/* Undo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={undo}
                disabled={!canUndo()}
                className={`
                  h-9 w-9 rounded-lg
                  ${!canUndo()
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Undo2 className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Undo (⌘Z)
            </TooltipContent>
          </Tooltip>

          {/* Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={redo}
                disabled={!canRedo()}
                className={`
                  h-9 w-9 rounded-lg
                  ${!canRedo()
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Redo2 className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Redo (⌘⇧Z)
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px bg-border my-1" />

          {/* Settings/Shortcuts */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowShortcuts(!showShortcuts)}
                className={`
                  h-9 w-9 rounded-lg
                  ${showShortcuts
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Settings className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Shortcuts (?)
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px bg-border my-1" />

          {/* Plugins */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={pluginButtonRef}
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPluginLauncher(!showPluginLauncher)}
                className={`
                  h-9 w-9 rounded-lg
                  ${showPluginLauncher
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Puzzle className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
              Plugins
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Plugin Launcher Dropdown */}
      <PluginLauncher
        isOpen={showPluginLauncher}
        onClose={() => setShowPluginLauncher(false)}
        onLaunch={(pluginId) => {
          if (onPluginLaunch) {
            onPluginLaunch(pluginId);
          }
          setShowPluginLauncher(false);
        }}
        anchorRef={pluginButtonRef}
      />
    </TooltipProvider>
  );
}
