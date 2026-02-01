'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { PluginLauncher } from '@/components/plugins/PluginLauncher';
// Import official plugins to register them
import '@/lib/plugins/official/storyboard-generator';
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
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };

    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside);
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

  const addMenuItems = [
    {
      section: 'NODES',
      items: [
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-teal-500/20 ring-2 ring-teal-500 flex items-center justify-center relative">
              <ImageIcon className="h-3 w-3 text-teal-500" />
              <Sparkle className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-teal-400 text-teal-400" />
            </div>
          ),
          label: 'Image Generator',
          onClick: () => handleAddNode(createImageGeneratorNode, 'Image Generator'),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-purple-500/20 ring-2 ring-purple-500 flex items-center justify-center">
              <Video className="h-3 w-3 text-purple-500" />
            </div>
          ),
          label: 'Video Generator',
          onClick: () => handleAddNode(createVideoGeneratorNode, 'Video Generator'),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-yellow-400/20 ring-2 ring-yellow-400 flex items-center justify-center">
              <Type className="h-3 w-3 text-yellow-400" />
            </div>
          ),
          label: 'Text',
          onClick: () => handleAddNode(createTextNode as any),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-red-400/20 ring-2 ring-red-400 flex items-center justify-center">
              <ImageIcon className="h-3 w-3 text-red-400" />
            </div>
          ),
          label: 'Media',
          onClick: () => handleAddNode(createMediaNode as any),
        },
      ],
    },
    {
      section: 'AUDIO',
      items: [
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-orange-400/20 ring-2 ring-orange-400 flex items-center justify-center">
              <Music className="h-3 w-3 text-orange-400" />
            </div>
          ),
          label: 'Music Generator',
          onClick: () => handleAddNode(createMusicGeneratorNode, 'Music Generator'),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-cyan-400/20 ring-2 ring-cyan-400 flex items-center justify-center">
              <Mic className="h-3 w-3 text-cyan-400" />
            </div>
          ),
          label: 'Speech',
          onClick: () => handleAddNode(createSpeechNode, 'Speech'),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-indigo-400/20 ring-2 ring-indigo-400 flex items-center justify-center">
              <Film className="h-3 w-3 text-indigo-400" />
            </div>
          ),
          label: 'Video Audio',
          onClick: () => handleAddNode(createVideoAudioNode, 'Video Audio'),
        },
      ],
    },
    {
      section: 'UTILITIES',
      items: [
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-amber-400/20 ring-2 ring-amber-400 flex items-center justify-center">
              <StickyNote className="h-3 w-3 text-amber-400" />
            </div>
          ),
          label: 'Sticky Note',
          onClick: () => handleAddNode(createStickyNoteNode as any),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-zinc-400/20 ring-2 ring-zinc-500 flex items-center justify-center">
              <Smile className="h-3 w-3 text-zinc-400" />
            </div>
          ),
          label: 'Sticker',
          onClick: () => handleAddNode(createStickerNode as any),
        },
        {
          icon: (
            <div className="h-5 w-5 rounded-full bg-blue-500/20 ring-2 ring-blue-500 flex items-center justify-center">
              <Group className="h-3 w-3 text-blue-500" />
            </div>
          ),
          label: 'Group',
          onClick: () => handleAddNode(createGroupNode, 'Group'),
        },
      ],
    },
  ];

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
            <div className="absolute top-0 left-full ml-2 w-[180px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-left-2 duration-150">
              {addMenuItems.map((section, idx) => (
                <div key={section.section}>
                  {idx > 0 && <div className="border-t border-border" />}
                  <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {section.section}
                  </div>
                  {section.items.map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
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
