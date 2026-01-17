'use client';

import { useState, useRef, useEffect } from 'react';
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
} from '@/stores/canvas-store';
import {
  Plus,
  Hand,
  Undo2,
  Redo2,
  Scissors,
  Settings,
  MousePointer2,
  Image as ImageIcon,
  Video,
  Type,
  StickyNote,
  Smile,
  Group,
  Sparkle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function NodeToolbar() {
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
            <div className="relative h-4 w-4">
              <ImageIcon className="h-4 w-4 text-emerald-400" />
              <Sparkle className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-emerald-400 text-emerald-400" />
            </div>
          ),
          label: 'Image Generator',
          onClick: () => handleAddNode(createImageGeneratorNode, 'Image Generator'),
        },
        {
          icon: <Video className="h-4 w-4 text-blue-400" />,
          label: 'Video Generator',
          onClick: () => handleAddNode(createVideoGeneratorNode, 'Video Generator'),
        },
        {
          icon: <Type className="h-4 w-4 text-zinc-400" />,
          label: 'Text',
          onClick: () => handleAddNode(createTextNode as any),
        },
        {
          icon: <ImageIcon className="h-4 w-4 text-zinc-400" />,
          label: 'Media',
          onClick: () => handleAddNode(createMediaNode as any),
        },
      ],
    },
    {
      section: 'UTILITIES',
      items: [
        {
          icon: <StickyNote className="h-4 w-4 text-yellow-400" />,
          label: 'Sticky Note',
          onClick: () => handleAddNode(createStickyNoteNode as any),
        },
        {
          icon: <Smile className="h-4 w-4 text-zinc-400" />,
          label: 'Sticker',
          onClick: () => handleAddNode(createStickerNode as any),
        },
        {
          icon: <Group className="h-4 w-4 text-indigo-400" />,
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
          <div className="bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-xl p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className={`
                    h-9 w-9 rounded-lg
                    ${showAddMenu
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }
                  `}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                Add Node
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Add Menu Dropdown */}
          {showAddMenu && (
            <div className="absolute top-0 left-full ml-2 w-[180px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-left-2 duration-150">
              {addMenuItems.map((section, idx) => (
                <div key={section.section}>
                  {idx > 0 && <div className="border-t border-zinc-800" />}
                  <div className="px-3 py-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                    {section.section}
                  </div>
                  {section.items.map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer transition-colors"
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
        <div className="bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-xl p-1 flex flex-col gap-0.5">
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
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <MousePointer2 className="h-[18px] w-[18px]" />
                {activeTool === 'select' && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
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
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <Hand className="h-[18px] w-[18px]" />
                {activeTool === 'pan' && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
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
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <Scissors className="h-[18px] w-[18px]" />
                {activeTool === 'scissors' && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
              Scissors (X)
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px bg-zinc-800 my-1" />

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
                    ? 'text-zinc-700 cursor-not-allowed'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <Undo2 className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
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
                    ? 'text-zinc-700 cursor-not-allowed'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <Redo2 className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
              Redo (⌘⇧Z)
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-px bg-zinc-800 my-1" />

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
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <Settings className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
              Shortcuts (?)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
