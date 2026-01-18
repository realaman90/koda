'use client';

const shortcuts = [
  {
    category: 'General',
    items: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'S'], description: 'Save' },
      { keys: ['F'], description: 'Fit view' },
      { keys: ['?'], description: 'Show shortcuts' },
    ],
  },
  {
    category: 'Selection',
    items: [
      { keys: ['Ctrl', 'A'], description: 'Select all' },
      { keys: ['Escape'], description: 'Deselect all' },
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['Backspace'], description: 'Delete selected' },
    ],
  },
  {
    category: 'Clipboard',
    items: [
      { keys: ['Ctrl', 'C'], description: 'Copy' },
      { keys: ['Ctrl', 'X'], description: 'Cut' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate' },
    ],
  },
  {
    category: 'Navigation',
    items: [
      { keys: ['Space'], description: 'Pan mode (hold)' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: ['Ctrl', '+'], description: 'Zoom in' },
      { keys: ['Ctrl', '-'], description: 'Zoom out' },
      { keys: ['Ctrl', '0'], description: 'Reset zoom' },
    ],
  },
  {
    category: 'Nodes',
    items: [
      { keys: ['1'], description: 'Add Image Generator' },
      { keys: ['2'], description: 'Add Video Generator' },
      { keys: ['3'], description: 'Add Text Node' },
      { keys: ['4'], description: 'Add Media Node' },
      { keys: ['Enter'], description: 'Generate (when node selected)' },
    ],
  },
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-medium bg-zinc-700 text-zinc-200 rounded border border-zinc-600 shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsSection() {
  return (
    <div className="space-y-6">
      {shortcuts.map((section) => (
        <div key={section.category}>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            {section.category}
          </h3>
          <div className="space-y-2">
            {section.items.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
              >
                <span className="text-sm text-zinc-400">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <span key={keyIndex} className="flex items-center gap-1">
                      <KeyBadge>{key}</KeyBadge>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-zinc-600 text-xs">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-zinc-500 mt-4">
        Tip: On macOS, use Cmd instead of Ctrl for most shortcuts.
      </p>
    </div>
  );
}
