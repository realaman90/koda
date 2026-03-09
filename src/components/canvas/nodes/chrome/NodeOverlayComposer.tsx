'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeOverlayComposerProps {
  preview?: ReactNode;
  expanded?: boolean;
  onExpand?: () => void;
  children?: ReactNode;
  className?: string;
  previewClassName?: string;
  composerClassName?: string;
}

export function NodeOverlayComposer({
  preview,
  expanded = false,
  onExpand,
  children,
  className,
  previewClassName,
  composerClassName,
}: NodeOverlayComposerProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!expanded && preview ? (
        onExpand ? (
          <button
            type="button"
            onClick={onExpand}
            className={cn('node-shell-prompt-preview node-interactive', previewClassName)}
          >
            {preview}
          </button>
        ) : (
          <div className={cn('node-shell-prompt-preview node-interactive', previewClassName)}>
            {preview}
          </div>
        )
      ) : null}
      {expanded && children ? <div className={cn('node-shell-composer node-interactive', composerClassName)}>{children}</div> : null}
    </div>
  );
}
