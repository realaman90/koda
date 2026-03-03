'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { LogOut, UserCircle2, CreditCard, Sparkles } from 'lucide-react';
import type { CurrentUser } from '@/hooks/useCurrentUser';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PLAN_BADGE_STYLES: Record<string, { label: string; className: string }> = {
  free_user: { label: 'Free', className: 'bg-zinc-700/60 text-zinc-300' },
  basic_user: { label: 'Basic', className: 'bg-blue-600/20 text-blue-400' },
  pro_user: { label: 'Pro', className: 'bg-purple-600/20 text-purple-400' },
  pro_plus_user: { label: 'Pro+', className: 'bg-amber-600/20 text-amber-400' },
};

interface AccountMenuProps {
  user: CurrentUser | null;
  displayName: string;
  initials: string;
  isLoading?: boolean;
}

export function AccountMenu({ user, displayName, initials, isLoading = false }: AccountMenuProps) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { credits } = useCredits();

  const email = user?.email || '';
  const avatarAlt = displayName || 'User avatar';

  const planBadge = credits
    ? PLAN_BADGE_STYLES[credits.planKey] ?? PLAN_BADGE_STYLES.free_user
    : null;

  const hasTopupBalance = !!(credits && credits.balance > credits.creditsPerMonth);
  const creditsLeftValue = hasTopupBalance ? credits!.lifetimeUsed : (credits?.balance ?? 0);
  const creditsRightValue = hasTopupBalance ? credits!.balance : (credits?.creditsPerMonth ?? 0);
  const usagePercent = credits && creditsRightValue > 0
    ? Math.min((creditsLeftValue / creditsRightValue) * 100, 100)
    : 0;

  const showUpgrade = credits && credits.planKey !== 'pro_plus_user';

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: '/sign-in' });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Open account menu"
        >
          {user?.imageUrl ? (
            <span
              role="img"
              aria-label={avatarAlt}
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${user.imageUrl})` }}
            />
          ) : (
            <span>{initials || 'U'}</span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
      >
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {isLoading ? 'Loading...' : displayName}
            </p>
            {planBadge && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none',
                  planBadge.className
                )}
              >
                {planBadge.label}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {isLoading ? 'Fetching account details' : email || 'No email available'}
          </p>

          {credits && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      usagePercent > 20 ? 'bg-primary' : 'bg-red-500'
                    )}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {creditsLeftValue} / {creditsRightValue}
                </span>
              </div>
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-accent focus:text-accent-foreground">
          <Link href="/settings" className="flex w-full items-center gap-2" aria-label="Go to account settings">
            <UserCircle2 className="h-4 w-4" />
            Profile &amp; Account
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-accent focus:text-accent-foreground">
          <Link href="/settings?tab=billing" className="flex w-full items-center gap-2" aria-label="Go to billing settings">
            <CreditCard className="h-4 w-4" />
            Billing &amp; Plan
          </Link>
        </DropdownMenuItem>

        {showUpgrade && (
          <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-accent focus:text-accent-foreground">
            <Link href="/settings?tab=billing" className="flex w-full items-center gap-2" aria-label="Upgrade your plan">
              <Sparkles className="h-4 w-4" />
              Upgrade Plan
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            if (!isSigningOut) {
              void handleSignOut();
            }
          }}
          className="rounded-lg px-3 py-2 text-red-400 focus:bg-red-500/10 focus:text-red-300"
          aria-disabled={isSigningOut}
          disabled={isSigningOut}
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
