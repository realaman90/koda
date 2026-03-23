'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeTitleRowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function NodeTitleRow({
  icon,
  title,
  subtitle,
  trailing,
  className,
}: NodeTitleRowProps) {
  return (
    <div className={cn('node-shell-title', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {trailing ? <div className="node-interactive shrink-0">{trailing}</div> : null}
    </div>
  );
}
