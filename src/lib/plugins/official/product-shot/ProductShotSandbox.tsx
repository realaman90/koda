'use client';

/**
 * @deprecated This modal-based sandbox is deprecated. Use ProductShotNode instead.
 *
 * The product shot generator has been moved from a modal-based plugin to a
 * canvas node. The same UI now renders directly on the canvas as ProductShotNode
 * (see src/components/canvas/nodes/ProductShotNode.tsx).
 *
 * This file is kept for the plugin registry requirement and will be removed
 * in a future version.
 */

import * as React from 'react';
import type { AgentSandboxProps } from '@/lib/plugins/types';

export function ProductShotSandbox({ onClose }: AgentSandboxProps) {
  return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">
        Product Shot Generator is now a canvas node. Close this dialog and use the node on the canvas instead.
      </p>
      <button
        onClick={onClose}
        className="mt-4 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
      >
        Close
      </button>
    </div>
  );
}
