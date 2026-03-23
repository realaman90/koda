'use client';

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';

const shortcuts = [
  { category: 'General', items: [
    { keys: ['⌘', 'Z'], description: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
    { keys: ['Esc'], description: 'Clear selection / Blur input' },
    { keys: ['?'], description: 'Toggle shortcuts panel' },
  ]},
  { category: 'Selection', items: [
    { keys: ['⌘', 'A'], description: 'Select all nodes' },
    { keys: ['Click edge'], description: 'Select edge' },
  ]},
  { category: 'Edit', items: [
    { keys: ['⌘', 'C'], description: 'Copy selected' },
    { keys: ['⌘', 'X'], description: 'Cut selected' },
    { keys: ['⌘', 'V'], description: 'Paste' },
    { keys: ['⌘', 'D'], description: 'Duplicate selected' },
    { keys: ['⌘', 'G'], description: 'Group selected' },
    { keys: ['⌫'], description: 'Delete selected' },
  ]},
  { category: 'Tools', items: [
    { keys: ['V'], description: 'Select tool' },
    { keys: ['H'], description: 'Pan tool' },
    { keys: ['X'], description: 'Scissors tool' },
  ]},
  { category: 'Zoom', items: [
    { keys: ['⌘', '+'], description: 'Zoom in' },
    { keys: ['⌘', '-'], description: 'Zoom out' },
    { keys: ['D'], description: 'Zoom to fit' },
    { keys: ['F'], description: 'Zoom to selection' },
    { keys: ['Scroll'], description: 'Zoom in/out' },
  ]},
  { category: 'Canvas', items: [
    { keys: ['Drag'], description: 'Select: box select / Pan: move canvas' },
    { keys: ['Drag handle'], description: 'Create connection (Select mode)' },
  ]},
];

export function KeyboardShortcuts() {
  const showShortcuts = useCanvasStore((state) => state.showShortcuts);
  const setShowShortcuts = useCanvasStore((state) => state.setShowShortcuts);

  // Listen for "?" key to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcuts, setShowShortcuts]);

  if (!showShortcuts) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowShortcuts(false)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="px-2 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-700 bg-zinc-800/50">
          <p className="text-xs text-zinc-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-zinc-700 rounded">?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
