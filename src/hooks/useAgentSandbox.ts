'use client';

/**
 * useAgentSandbox Hook
 *
 * State management for the Agent Sandbox modal.
 * Handles opening, closing, and tracking the active plugin.
 */

import { useState, useCallback } from 'react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

interface UseAgentSandboxReturn {
  /** Currently active plugin (null if no sandbox is open) */
  activePlugin: AgentPlugin | null;
  /** Whether a sandbox is currently open */
  isOpen: boolean;
  /** Open the sandbox for a specific plugin by ID */
  openSandbox: (pluginId: string) => void;
  /** Close the currently open sandbox */
  closeSandbox: () => void;
}

/**
 * Hook for managing Agent Sandbox state
 *
 * @example
 * ```tsx
 * const { activePlugin, isOpen, openSandbox, closeSandbox } = useAgentSandbox();
 *
 * // Open a plugin sandbox
 * openSandbox('storyboard-generator');
 *
 * // Render the sandbox modal
 * {activePlugin && (
 *   <AgentSandbox plugin={activePlugin} onClose={closeSandbox} />
 * )}
 * ```
 */
export function useAgentSandbox(): UseAgentSandboxReturn {
  const [activePlugin, setActivePlugin] = useState<AgentPlugin | null>(null);

  const openSandbox = useCallback((pluginId: string) => {
    const plugin = pluginRegistry.get(pluginId);
    if (plugin) {
      setActivePlugin(plugin);
    } else {
      console.warn(`Plugin with ID "${pluginId}" not found in registry`);
    }
  }, []);

  const closeSandbox = useCallback(() => {
    setActivePlugin(null);
  }, []);

  return {
    activePlugin,
    isOpen: activePlugin !== null,
    openSandbox,
    closeSandbox,
  };
}
