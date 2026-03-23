'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeFooterRailProps {
  children?: ReactNode;
  className?: string;
}

export function NodeFooterRail({ children, className }: NodeFooterRailProps) {
  if (!children) {
    return null;
  }

  return (
    <div className={cn('node-bottom-toolbar node-footer-rail node-interactive', className)}>
      {children}
    </div>
  );
}
