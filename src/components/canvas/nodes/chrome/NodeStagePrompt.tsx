'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeStagePromptProps {
  teaser?: ReactNode;
  expanded?: boolean;
  onExpand?: () => void;
  children?: ReactNode;
  className?: string;
  teaserClassName?: string;
  editorClassName?: string;
}

export function NodeStagePrompt({
  teaser,
  expanded = false,
  onExpand,
  children,
  className,
  teaserClassName,
  editorClassName,
}: NodeStagePromptProps) {
  return (
    <div className={cn('node-stage-prompt', className)}>
      {!expanded && teaser ? (
        onExpand ? (
          <button
            type="button"
            onClick={onExpand}
            className={cn('node-stage-prompt-teaser node-interactive nodrag nopan', teaserClassName)}
          >
            {teaser}
          </button>
        ) : (
          <div className={cn('node-stage-prompt-teaser node-interactive nodrag nopan', teaserClassName)}>
            {teaser}
          </div>
        )
      ) : null}
      {expanded && children ? (
        <div className={cn('node-stage-prompt-editor node-interactive nodrag nopan', editorClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
