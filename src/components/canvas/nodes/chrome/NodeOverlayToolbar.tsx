'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeOverlayToolbarProps {
  children: ReactNode;
  className?: string;
}

export function NodeOverlayToolbar({ children, className }: NodeOverlayToolbarProps) {
  if (!children) {
    return null;
  }

  return <div className={cn('node-shell-toolbar node-interactive', className)}>{children}</div>;
}
