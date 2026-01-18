'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';

// Use useLayoutEffect on client to avoid flash, fallback to useEffect for SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;

    const applyTheme = (resolvedTheme: 'dark' | 'light') => {
      // Toggle classes atomically to avoid flash of wrong theme
      if (resolvedTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }

      // Also set a data attribute for additional styling hooks
      root.setAttribute('data-theme', resolvedTheme);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  return <>{children}</>;
}
