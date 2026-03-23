'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NodeMediaBadgeProps {
  children: ReactNode;
  className?: string;
}

export function NodeMediaBadge({ children, className }: NodeMediaBadgeProps) {
  return <div className={cn('node-media-badge', className)}>{children}</div>;
}
