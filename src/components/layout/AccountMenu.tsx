'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { LogOut, UserCircle2 } from 'lucide-react';
import type { CurrentUser } from '@/hooks/useCurrentUser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AccountMenuProps {
  user: CurrentUser | null;
  displayName: string;
  initials: string;
  isLoading?: boolean;
}

export function AccountMenu({ user, displayName, initials, isLoading = false }: AccountMenuProps) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const email = user?.email || '';
  const avatarAlt = displayName || 'User avatar';

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
          <p className="truncate text-sm font-medium text-foreground">{isLoading ? 'Loading…' : displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isLoading ? 'Fetching account details' : email || 'No email available'}
          </p>
        </div>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem asChild className="rounded-lg px-3 py-2 focus:bg-accent focus:text-accent-foreground">
          <Link href="/settings" className="flex w-full items-center gap-2" aria-label="Go to account settings">
            <UserCircle2 className="h-4 w-4" />
            Profile &amp; Account
          </Link>
        </DropdownMenuItem>

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
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
