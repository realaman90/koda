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
    { keys: ['Drag'], description: 'Pan canvas (Select mode)' },
    { keys: ['Shift', 'Drag'], description: 'Box select nodes' },
    { keys: ['Space', 'Drag'], description: 'Temporarily pan while using other tools' },
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="bg-popover border border-border rounded-xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden text-popover-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowShortcuts(false)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors">
                    <span className="text-sm text-foreground/90">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="px-2 py-1 text-xs font-medium text-foreground bg-muted border border-border rounded shadow-sm"
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
        <div className="px-5 py-3 border-t border-border bg-muted/40">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded text-foreground">?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
