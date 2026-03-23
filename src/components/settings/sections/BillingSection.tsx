'use client';

import { useEffect } from 'react';
import { PricingTable } from '@clerk/nextjs';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';

const PLAN_BADGE_STYLES: Record<string, string> = {
  free_user: 'bg-zinc-700/60 text-zinc-300',
  basic_user: 'bg-blue-600/20 text-blue-400',
  pro_user: 'bg-purple-600/20 text-purple-400',
  pro_plus_user: 'bg-amber-600/20 text-amber-400',
};

const PLAN_LABELS: Record<string, string> = {
  free_user: 'Free',
  basic_user: 'Basic',
  pro_user: 'Pro',
  pro_plus_user: 'Pro+',
};

function formatResetDate(periodStart: string): string {
  const start = new Date(periodStart);
  const reset = new Date(start);
  reset.setMonth(reset.getMonth() + 1);
  return reset.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function BillingSection() {
  const { credits, isLoading, refresh } = useCredits();

  // Re-fetch credits when tab gains focus (returning from checkout)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading billing details...</p>;
  }

  if (!credits) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Unable to load billing information.</p>
      </div>
    );
  }

  const { balance, planKey, creditsPerMonth, lifetimeUsed, periodStart } = credits;
  const hasTopupBalance = balance > creditsPerMonth;
  const leftValue = hasTopupBalance ? lifetimeUsed : balance;
  const rightValue = hasTopupBalance ? balance : creditsPerMonth;
  const usagePercent = rightValue > 0 ? Math.min((leftValue / rightValue) * 100, 100) : 0;
  const usageLabel = hasTopupBalance ? 'Credits used / available' : 'Credits remaining';

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <div className="rounded-lg border border-border bg-muted/20 p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-base font-semibold text-foreground">Current Plan</h3>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              PLAN_BADGE_STYLES[planKey] ?? PLAN_BADGE_STYLES.free_user
            )}
          >
            {PLAN_LABELS[planKey] ?? 'Free'}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">{usageLabel}</span>
              <span className="font-medium text-foreground">{leftValue} / {rightValue}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent > 20 ? 'bg-primary' : 'bg-red-500'
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Resets on</span>
            <span className="text-foreground">{formatResetDate(periodStart)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lifetime used</span>
            <span className="text-foreground">{lifetimeUsed} credits</span>
          </div>
        </div>
      </div>

      {/* Clerk Pricing Table */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">Plans</h3>
        <PricingTable
          newSubscriptionRedirectUrl="/settings?tab=billing"
          appearance={{
            elements: {
              pricingTableButton: 'bg-primary text-primary-foreground hover:bg-primary/90 rounded-md',
            },
          }}
        />
      </div>

      {/* Usage Note */}
      <div className="rounded-lg border border-border bg-muted/10 p-4">
        <p className="text-xs text-muted-foreground">
          Credits reset monthly on your billing date. Unused credits do not roll over.
        </p>
      </div>
    </div>
  );
}
