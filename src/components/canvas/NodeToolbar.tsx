'use client';

import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import {
  Play,
  Hand,
  Undo2,
  Redo2,
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
import { AddNodeDropdown } from './AddNodeDropdown';

export function NodeToolbar() {
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute left-4 top-4 z-10">
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700/50 rounded-xl p-1.5 flex flex-col gap-1">
          {/* Row 1: Tools | Add | Run */}
          <div className="flex items-center gap-1">
            {/* Tool buttons */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveTool('select')}
                    className={`
                      h-8 w-8 rounded-lg
                      ${activeTool === 'select'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                    `}
                  >
                    <MousePointer2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Select (V)
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveTool('pan')}
                    className={`
                      h-8 w-8 rounded-lg
                      ${activeTool === 'pan'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                    `}
                  >
                    <Hand className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Pan (H)
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveTool('scissors')}
                    className={`
                      h-8 w-8 rounded-lg
                      ${activeTool === 'scissors'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                    `}
                  >
                    <Scissors className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Scissors (X) - drag to cut edges
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-700/50 mx-1" />

            {/* Add Node Dropdown */}
            <AddNodeDropdown />

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-700/50 mx-1" />

            {/* Run All */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={runAll}
                  disabled={!hasRunnableGenerators || isRunningAll}
                  className={`
                    h-8 w-8 rounded-lg
                    ${isRunningAll
                      ? 'bg-emerald-600 text-white'
                      : !hasRunnableGenerators
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-emerald-400 hover:text-white hover:bg-emerald-600/20'
                    }
                  `}
                >
                  <Play className={`h-4 w-4 ${isRunningAll ? 'animate-pulse' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                Run All
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Row 2: History | Help */}
          <div className="flex items-center gap-1">
            {/* History buttons */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={undo}
                    disabled={!canUndo()}
                    className={`
                      h-8 w-8 rounded-lg
                      ${!canUndo()
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                    `}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Undo (Cmd+Z)
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={redo}
                    disabled={!canRedo()}
                    className={`
                      h-8 w-8 rounded-lg
                      ${!canRedo()
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                    `}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Redo (Cmd+Shift+Z)
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-700/50 mx-1" />

            {/* Help */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className={`
                    h-8 w-8 rounded-lg
                    ${showShortcuts
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }
                  `}
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                Keyboard Shortcuts (?)
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
