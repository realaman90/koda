'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface KodaLogoProps {
  variant?: 'icon' | 'full';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
}

const sizes = {
  icon: {
    sm: { width: 20, height: 20 },
    md: { width: 24, height: 24 },
    lg: { width: 28, height: 28 },
  },
  full: {
    sm: { width: 112, height: 28 },
    md: { width: 136, height: 34 },
    lg: { width: 160, height: 40 },
  },
};

const sizeClasses = {
  icon: {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7',
  },
  full: {
    sm: 'h-6 w-auto',
    md: 'h-7 w-auto',
    lg: 'h-8 w-auto',
  },
} as const;

export function KodaLogo({ variant = 'icon', className, size = 'md', priority = false }: KodaLogoProps) {
  const dimensions = sizes[variant][size];
  const lightSrc = variant === 'icon' ? '/logos/koda_small_light.png' : '/logos/koda_main_light.svg';
  const darkSrc = variant === 'icon' ? '/logos/koda_small_dark.png' : '/logos/koda_main_dark.png';
  const renderedSizeClass = sizeClasses[variant][size];

  return (
    <span className={cn('inline-flex flex-shrink-0', className)}>
      <Image
        src={lightSrc}
        alt="Koda.video"
        width={dimensions.width}
        height={dimensions.height}
        className={cn('dark:hidden', renderedSizeClass)}
        priority={priority}
      />
      <Image
        src={darkSrc}
        alt="Koda.video"
        width={dimensions.width}
        height={dimensions.height}
        className={cn('hidden dark:block', renderedSizeClass)}
        priority={priority}
      />
    </span>
  );
}
