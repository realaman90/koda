'use client';

import { useCallback, useEffect, useState } from 'react';

export type CreditInfo = {
  balance: number;
  planKey: string;
  creditsPerMonth: number;
  lifetimeUsed: number;
  periodStart: string;
};

export function useCredits() {
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/credits');
      if (!response.ok) {
        setCredits(null);
        return;
      }
      const data = await response.json();
      setCredits(data);
    } catch {
      setCredits(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/credits');
        if (!response.ok) {
          if (!cancelled) setCredits(null);
          return;
        }
        const data = await response.json();
        if (!cancelled) setCredits(data);
      } catch {
        if (!cancelled) setCredits(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { credits, isLoading, refresh };
}
