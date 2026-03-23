'use client';

import { useAppStore } from '@/stores/app-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { CanvasMutationKind, CanvasMutationPreview } from '@/stores/canvas-store-helpers';

interface UseBufferedNodeFieldOptions {
  nodeId: string;
  value: string;
  field: string;
  kind?: Extract<CanvasMutationKind, 'content' | 'typing'>;
  preview?: CanvasMutationPreview;
  commitOnEnter?: boolean;
  enterRequiresMeta?: boolean;
}

export function useBufferedNodeField({
  nodeId,
  value,
  field,
  kind = 'content',
  preview = 'schedule',
  commitOnEnter = false,
  enterRequiresMeta = false,
}: UseBufferedNodeFieldOptions) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const flushCanvasPersistence = useAppStore((state) => state.flushCanvasPersistence);
  const [draft, setDraft] = useState(value);
  const commitValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value);
    commitValueRef.current = value;
  }, [nodeId, value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const scheduleTypingSync = useCallback((nextValue: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      updateNodeData(
        nodeId,
        { [field]: nextValue },
        { history: 'skip', save: 'skip', preview: 'skip', kind: 'typing' }
      );
    }, 750);
  }, [field, nodeId, updateNodeData]);

  const updateDraft = useCallback((nextValue: string) => {
    setDraft(nextValue);
    scheduleTypingSync(nextValue);
  }, [scheduleTypingSync]);

  const commit = useCallback(async (nextValue: string = draft, flush = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (commitValueRef.current === nextValue) {
      if (flush) {
        await flushCanvasPersistence(preview === 'schedule');
      }
      return;
    }

    commitValueRef.current = nextValue;
    updateNodeData(
      nodeId,
      { [field]: nextValue },
      { history: 'push', save: 'schedule', preview, kind }
    );

    if (flush) {
      await flushCanvasPersistence(preview === 'schedule');
    }
  }, [draft, field, flushCanvasPersistence, kind, nodeId, preview, updateNodeData]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    updateDraft(nextValue);
  }, [updateDraft]);

  const handleBlur = useCallback(async () => {
    await commit(draft, true);
  }, [commit, draft]);

  const handleKeyDown = useCallback(async (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!commitOnEnter || event.key !== 'Enter') {
      return;
    }

    if (enterRequiresMeta && !(event.metaKey || event.ctrlKey)) {
      return;
    }

    if (!enterRequiresMeta && event.shiftKey) {
      return;
    }

    event.preventDefault();
    await commit(draft, true);
  }, [commit, commitOnEnter, draft, enterRequiresMeta]);

  return {
    draft,
    setDraft,
    updateDraft,
    handleChange,
    handleBlur,
    handleKeyDown,
    commit,
  };
}
