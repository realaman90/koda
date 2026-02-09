'use client';

import { useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvas-store';

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true } = options;

  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const copySelected = useCanvasStore((state) => state.copySelected);
  const cutSelected = useCanvasStore((state) => state.cutSelected);
  const paste = useCanvasStore((state) => state.paste);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);
  const selectAll = useCanvasStore((state) => state.selectAll);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const groupSelected = useCanvasStore((state) => state.groupSelected);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow some shortcuts even in input fields
      const allowInInput = ['Escape'];

      if (isInputField && !allowInInput.includes(event.key)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Undo: Cmd/Ctrl + Z
      if (cmdOrCtrl && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (cmdOrCtrl && (event.key === 'Z' || (event.shiftKey && event.key === 'z') || event.key === 'y')) {
        event.preventDefault();
        redo();
        return;
      }

      // Copy: Cmd/Ctrl + C
      if (cmdOrCtrl && event.key === 'c') {
        event.preventDefault();
        copySelected();
        return;
      }

      // Cut: Cmd/Ctrl + X
      if (cmdOrCtrl && event.key === 'x') {
        event.preventDefault();
        cutSelected();
        return;
      }

      // Paste: Cmd/Ctrl + V
      if (cmdOrCtrl && event.key === 'v') {
        event.preventDefault();
        paste();
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (cmdOrCtrl && event.key === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      // Select All: Cmd/Ctrl + A
      if (cmdOrCtrl && event.key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }

      // Group Selected: Cmd/Ctrl + G
      if (cmdOrCtrl && event.key === 'g') {
        event.preventDefault();
        groupSelected();
        return;
      }

      // Delete: Backspace or Delete
      if (event.key === 'Backspace' || event.key === 'Delete') {
        // Only delete if we have selected nodes and not in an input field
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }

      // Escape: Clear selection (allow in input fields to blur)
      if (event.key === 'Escape') {
        if (isInputField) {
          (target as HTMLInputElement).blur();
        }
        return;
      }

      // Tool shortcuts (V, H, X)
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        setActiveTool('select');
        return;
      }

      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        setActiveTool('pan');
        return;
      }

      if (event.key === 'x' || event.key === 'X') {
        // Only if not Cmd+X (cut)
        if (!cmdOrCtrl) {
          event.preventDefault();
          setActiveTool('scissors');
          return;
        }
      }
    },
    [undo, redo, copySelected, cutSelected, paste, deleteSelected, duplicateSelected, selectAll, groupSelected, selectedNodeIds, setActiveTool]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
