'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBillingPromptStore } from '@/stores/billing-prompt-store';

export function BillingPromptModal() {
  const router = useRouter();
  const isOpen = useBillingPromptStore((state) => state.isOpen);
  const message = useBillingPromptStore((state) => state.message);
  const required = useBillingPromptStore((state) => state.required);
  const balance = useBillingPromptStore((state) => state.balance);
  const close = useBillingPromptStore((state) => state.close);

  const billingEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, isOpen]);

  if (!isOpen) return null;

  const handleOpenBilling = () => {
    close();
    router.push('/settings?tab=billing');
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close billing prompt"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-prompt-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-500/20 via-orange-500/12 to-rose-500/20" />

        <button
          type="button"
          aria-label="Dismiss billing prompt"
          className="absolute right-4 top-4 rounded-full border border-border/70 bg-background/80 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pb-6 pt-7">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/12 text-amber-300">
            <Sparkles className="h-5 w-5" />
          </div>

          <h2 id="billing-prompt-title" className="text-xl font-semibold text-foreground">
            You&apos;re out of credits
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>

          {(required !== null || balance !== null) && (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {required !== null && (
                <div>
                  Required: <span className="font-medium text-foreground">{required}</span> credits
                </div>
              )}
              {balance !== null && (
                <div>
                  Available: <span className="font-medium text-foreground">{balance}</span> credits
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Upgrade or manage your plan in Billing, then come back and run the generation again.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {billingEnabled ? (
              <Button className="flex-1" onClick={handleOpenBilling}>
                <CreditCard className="h-4 w-4" />
                Go to Billing
              </Button>
            ) : (
              <Button className="flex-1" disabled>
                <CreditCard className="h-4 w-4" />
                Billing Unavailable
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={close}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
