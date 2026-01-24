'use client';

/**
 * Canvas API Provider
 *
 * React context that provides the Canvas API to plugin sandbox components.
 * Must be used within a ReactFlowProvider context.
 */

import * as React from 'react';
import { useCanvasAPI } from '@/lib/plugins/canvas-api';
import type { CanvasAPI } from '@/lib/plugins/types';

// Context for the Canvas API
const CanvasAPIContext = React.createContext<CanvasAPI | null>(null);

/**
 * Hook to access the Canvas API within a plugin sandbox
 * @throws Error if used outside of CanvasAPIProvider
 */
export function useCanvasAPIContext(): CanvasAPI {
  const context = React.useContext(CanvasAPIContext);
  if (!context) {
    throw new Error('useCanvasAPIContext must be used within a CanvasAPIProvider');
  }
  return context;
}

interface CanvasAPIProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that wraps plugin sandbox content
 * Provides access to the Canvas API for reading and creating nodes/edges
 */
export function CanvasAPIProvider({ children }: CanvasAPIProviderProps) {
  const canvasAPI = useCanvasAPI();

  return (
    <CanvasAPIContext.Provider value={canvasAPI}>
      {children}
    </CanvasAPIContext.Provider>
  );
}
