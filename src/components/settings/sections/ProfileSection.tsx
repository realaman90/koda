'use client';

import { Mail, User } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function getDisplayName(firstName: string | null, lastName: string | null, email: string) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || email.split('@')[0] || 'User';
}

export function ProfileSection() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading account details…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">No authenticated user found.</p>
      </div>
    );
  }

  const displayName = getDisplayName(user.firstName, user.lastName, user.email);
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="h-20 w-20 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
            {initials}
          </div>
        )}
        <div>
          <h3 className="text-lg font-medium text-foreground">{displayName}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Display Name</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={displayName}
            readOnly
            className="h-10 w-full rounded-lg border border-border bg-muted pl-10 pr-4 text-sm text-foreground"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={user.email}
            readOnly
            className="h-10 w-full rounded-lg border border-border bg-muted pl-10 pr-4 text-sm text-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Account details are synced from your authenticated profile.
        </p>
      </div>
    </div>
  );
}
