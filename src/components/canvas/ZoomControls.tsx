'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ChevronUp, ZoomIn, ZoomOut, Maximize, Focus } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView, getZoom, setViewport, getViewport } = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const [isOpen, setIsOpen] = useState(false);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const nodes = useCanvasStore((state) => state.nodes);

  // Update zoom display
  useEffect(() => {
    const updateZoom = () => {
      const currentZoom = getZoom();
      setZoom(Math.round(currentZoom * 100));
    };

    updateZoom();
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [getZoom]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.zoom-controls-container')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Zoom in: Cmd/Ctrl + Plus or Cmd/Ctrl + =
      if (cmdOrCtrl && (event.key === '+' || event.key === '=' || event.key === 'Equal')) {
        event.preventDefault();
        zoomIn({ duration: 200 });
        return;
      }

      // Zoom out: Cmd/Ctrl + Minus
      if (cmdOrCtrl && (event.key === '-' || event.key === 'Minus')) {
        event.preventDefault();
        zoomOut({ duration: 200 });
        return;
      }

      // Zoom to fit: D
      if (event.key === 'd' && !cmdOrCtrl) {
        event.preventDefault();
        fitView({ padding: 0.2, duration: 200 });
        return;
      }

      // Zoom to selection: F
      if (event.key === 'f' && !cmdOrCtrl) {
        event.preventDefault();
        if (selectedNodeIds.length > 0) {
          const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
          fitView({ nodes: selectedNodes, padding: 0.3, duration: 200 });
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, fitView, selectedNodeIds, nodes]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
    setIsOpen(false);
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
    setIsOpen(false);
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 200 });
    setIsOpen(false);
  }, [fitView]);

  const handleZoomToSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + 280); // Approximate node width
      maxY = Math.max(maxY, node.position.y + 200); // Approximate node height
    });

    fitView({
      nodes: selectedNodes,
      padding: 0.3,
      duration: 200,
    });
    setIsOpen(false);
  }, [selectedNodeIds, nodes, fitView]);

  const handleSetZoom = useCallback((newZoom: number) => {
    const viewport = getViewport();
    setViewport({ ...viewport, zoom: newZoom / 100 }, { duration: 200 });
    setIsOpen(false);
  }, [getViewport, setViewport]);

  const zoomPresets = [25, 50, 75, 100, 125, 150, 200];

  const menuItems = [
    {
      id: 'zoom-in',
      icon: <ZoomIn className="h-4 w-4" />,
      label: 'Zoom in',
      shortcut: '⌘ +',
      action: handleZoomIn,
      disabled: false,
    },
    {
      id: 'zoom-out',
      icon: <ZoomOut className="h-4 w-4" />,
      label: 'Zoom out',
      shortcut: '⌘ -',
      action: handleZoomOut,
      disabled: false,
    },
    {
      id: 'divider1',
      divider: true,
    },
    {
      id: 'fit-view',
      icon: <Maximize className="h-4 w-4" />,
      label: 'Zoom to fit',
      shortcut: 'D',
      action: handleFitView,
      disabled: false,
    },
    {
      id: 'zoom-selection',
      icon: <Focus className="h-4 w-4" />,
      label: 'Zoom to selection',
      shortcut: 'F',
      action: handleZoomToSelection,
      disabled: selectedNodeIds.length === 0,
    },
  ];

  return (
    <div className="zoom-controls-container absolute bottom-4 right-4 z-10">
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Zoom Options */}
          <div className="py-1">
            {menuItems.map((item) => {
              if ('divider' in item && item.divider) {
                return <div key={item.id} className="my-1 border-t border-zinc-800" />;
              }

              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  disabled={item.disabled}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-sm
                    ${item.disabled
                      ? 'text-zinc-600 cursor-not-allowed'
                      : 'text-zinc-300 hover:bg-zinc-800 cursor-pointer'
                    }
                    transition-colors
                  `}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs text-zinc-500">{item.shortcut}</span>
                </button>
              );
            })}
          </div>

          {/* Zoom Presets */}
          <div className="border-t border-zinc-800 py-1">
            <div className="px-3 py-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              Zoom Level
            </div>
            <div className="flex flex-wrap gap-1 px-2 pb-2">
              {zoomPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSetZoom(preset)}
                  className={`
                    px-2 py-1 text-xs rounded
                    ${Math.abs(zoom - preset) < 5
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    }
                    transition-colors
                  `}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Zoom Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 backdrop-blur border border-zinc-700/50 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <span className="min-w-[40px] text-center font-medium">{zoom}%</span>
        <ChevronUp className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
