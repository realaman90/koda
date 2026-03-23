'use client';

/**
 * Agent Sandbox Modal
 *
 * Modal container for agent plugins. Renders the plugin's sandbox component
 * with access to the Canvas API and notification system.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CanvasAPIProvider, useCanvasAPIContext } from './CanvasAPIProvider';
import type { AgentPlugin, SandboxSize, AgentSandboxProps as PluginSandboxProps } from '@/lib/plugins/types';

// Size configurations for the sandbox modal
const sizeClasses: Record<SandboxSize, string> = {
  small: 'w-[400px] max-h-[500px]',
  medium: 'w-[600px] max-h-[700px]',
  large: 'w-[800px] max-h-[85vh]',
  fullscreen: 'w-[90vw] h-[90vh]',
};

interface AgentSandboxModalProps {
  plugin: AgentPlugin;
  onClose: () => void;
}

/**
 * Inner component that has access to the Canvas API context
 */
function AgentSandboxContent({ plugin, onClose }: AgentSandboxModalProps) {
  const canvas = useCanvasAPIContext();

  // Notification helper
  const notify = React.useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      switch (type) {
        case 'success':
          toast.success(message);
          break;
        case 'error':
          toast.error(message);
          break;
        case 'info':
        default:
          toast.info(message);
          break;
      }
    },
    []
  );

  // Guard: node-based plugins don't have sandbox components
  if (!plugin.sandbox) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">
          This plugin renders as a canvas node. Add it from the toolbar or context menu.
        </p>
      </div>
    );
  }

  const SandboxComponent = plugin.sandbox.component;

  return (
    <SandboxComponent
      canvas={canvas}
      onClose={onClose}
      notify={notify}
    />
  );
}

/**
 * Agent Sandbox Modal
 *
 * Renders a modal with the plugin's sandbox component.
 * Provides Canvas API access through context.
 */
export function AgentSandbox({ plugin, onClose }: AgentSandboxModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  // Handle client-side mounting for portal
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close on escape key and prevent body scroll
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!mounted) {
    return null;
  }

  // For node-based plugins without sandbox, show a simple info modal
  const sandboxSize = plugin.sandbox?.size || 'small';
  const sandboxTitle = plugin.sandbox?.title || plugin.name;

  const modal = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={cn(
          'bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col',
          sizeClasses[sandboxSize]
        )}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <plugin.icon className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-zinc-200">
              {sandboxTitle}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <CanvasAPIProvider>
            <AgentSandboxContent plugin={plugin} onClose={onClose} />
          </CanvasAPIProvider>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
