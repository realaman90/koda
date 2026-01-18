'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSettingsStore } from '@/stores/settings-store';
import { cn } from '@/lib/utils';

interface KodaLogoProps {
  variant?: 'icon' | 'full';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  icon: {
    sm: { width: 24, height: 24 },
    md: { width: 32, height: 32 },
    lg: { width: 40, height: 40 },
  },
  full: {
    sm: { width: 100, height: 30 },
    md: { width: 120, height: 36 },
    lg: { width: 160, height: 48 },
  },
};

export function KodaLogo({ variant = 'icon', className, size = 'md' }: KodaLogoProps) {
  const theme = useSettingsStore((state) => state.theme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');

      const listener = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  const logoSrc = variant === 'icon'
    ? `/logos/koda-icon-${resolvedTheme}.svg`
    : `/logos/koda-logo-${resolvedTheme}.svg`;

  const dimensions = sizes[variant][size];

  return (
    <Image
      src={logoSrc}
      alt="Koda.video"
      width={dimensions.width}
      height={dimensions.height}
      className={cn('flex-shrink-0', className)}
      priority
    />
  );
}
