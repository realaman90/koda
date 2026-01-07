'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore, createImageGeneratorNode, createVideoGeneratorNode, createTextNode, createMediaNode } from '@/stores/canvas-store';
import {
  Plus,
  Play,
  Hand,
  Type,
  Image as ImageIcon,
  Video,
  Undo2,
  Redo2,
  Settings,
  Sparkle,
  Scissors,
  Keyboard,
  MousePointer2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function NodeToolbar() {
  const addNode = useCanvasStore((state) => state.addNode);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const nodes = useCanvasStore((state) => state.nodes);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);
  const runAll = useCanvasStore((state) => state.runAll);
  const isRunningAll = useCanvasStore((state) => state.isRunningAll);
  const showShortcuts = useCanvasStore((state) => state.showShortcuts);
  const setShowShortcuts = useCanvasStore((state) => state.setShowShortcuts);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);

  // Check if there are any generators with prompts
  const hasRunnableGenerators = nodes.some((n) => {
    if (n.type !== 'imageGenerator') return false;
    const data = n.data as { prompt?: string };
    return !!data.prompt;
  });

  const getRandomPosition = useCallback(() => ({
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 200,
  }), []);

  const handleAddImageGenerator = useCallback(() => {
    const count = nodes.filter((n) => n.type === 'imageGenerator').length + 1;
    addNode(createImageGeneratorNode(getRandomPosition(), `Image Generator ${count}`));
  }, [addNode, getRandomPosition, nodes]);

  const handleAddVideoGenerator = useCallback(() => {
    const count = nodes.filter((n) => n.type === 'videoGenerator').length + 1;
    addNode(createVideoGeneratorNode(getRandomPosition(), `Video Generator ${count}`));
  }, [addNode, getRandomPosition, nodes]);

  const handleAddText = useCallback(() => {
    addNode(createTextNode(getRandomPosition()));
  }, [addNode, getRandomPosition]);

  const handleAddMedia = useCallback(() => {
    addNode(createMediaNode(getRandomPosition()));
  }, [addNode, getRandomPosition]);

  const toolbarItems = [
    // Tools
    { id: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select (V)', onClick: () => setActiveTool('select'), active: activeTool === 'select', disabled: false },
    { id: 'pan', icon: <Hand className="h-4 w-4" />, label: 'Pan (H)', onClick: () => setActiveTool('pan'), active: activeTool === 'pan', disabled: false },
    { id: 'scissors', icon: <Scissors className="h-4 w-4" />, label: 'Scissors (X) - drag to cut edges', onClick: () => setActiveTool('scissors'), active: activeTool === 'scissors', disabled: false },
    { id: 'divider1', type: 'divider' },
    // Add nodes
    { id: 'image-gen', icon: <div className="relative h-4 w-4 overflow-visible"><ImageIcon className="h-4 w-4" /><Sparkle className="absolute -top-[3px] -right-[3px] fill-current" style={{ width: '6px', height: '6px' }} /></div>, label: 'Image Generator', onClick: handleAddImageGenerator, active: false, disabled: false },
    { id: 'video-gen', icon: <Video className="h-4 w-4" />, label: 'Video Generator', onClick: handleAddVideoGenerator, active: false, disabled: false },
    { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text Node', onClick: handleAddText, active: false, disabled: false },
    { id: 'media', icon: <ImageIcon className="h-4 w-4" />, label: 'Media Node', onClick: handleAddMedia, active: false, disabled: false },
    { id: 'divider2', type: 'divider' },
    // Actions
    { id: 'run', icon: <Play className="h-4 w-4" />, label: 'Run All', onClick: runAll, active: isRunningAll, disabled: !hasRunnableGenerators || isRunningAll },
    { id: 'divider3', type: 'divider' },
    { id: 'undo', icon: <Undo2 className="h-4 w-4" />, label: 'Undo (Cmd+Z)', onClick: undo, active: false, disabled: !canUndo() },
    { id: 'redo', icon: <Redo2 className="h-4 w-4" />, label: 'Redo (Cmd+Shift+Z)', onClick: redo, active: false, disabled: !canRedo() },
    { id: 'divider4', type: 'divider' },
    { id: 'shortcuts', icon: <Keyboard className="h-4 w-4" />, label: 'Keyboard Shortcuts (?)', onClick: () => setShowShortcuts(!showShortcuts), active: showShortcuts, disabled: false },
    { id: 'settings', icon: <Settings className="h-4 w-4" />, label: 'Settings', onClick: () => {}, active: false, disabled: true },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700/50 rounded-xl p-1.5 flex flex-col gap-1">
          {toolbarItems.map((item) => {
            if (item.type === 'divider') {
              return <div key={item.id} className="h-px bg-zinc-700/50 my-1" />;
            }

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`
                      h-9 w-9 rounded-lg
                      ${item.active
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                      ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {item.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Clear button - only show when there are nodes */}
        {nodes.length > 0 && (
          <Button
            onClick={clearCanvas}
            variant="ghost"
            size="sm"
            className="mt-3 text-zinc-500 hover:text-zinc-300 text-xs w-full"
          >
            Clear
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
