'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeFloatingToolbarProps {
  children?: ReactNode;
  className?: string;
}

export function NodeFloatingToolbar({ children, className }: NodeFloatingToolbarProps) {
  if (!children) {
    return null;
  }

  return (
    <div className={cn('node-toolbar-floating node-floating-toolbar node-interactive', className)}>
      {children}
    </div>
  );
}
