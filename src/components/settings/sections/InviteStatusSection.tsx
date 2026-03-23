'use client';

import { useEffect, useState } from 'react';

type InviteRow = {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  role: string;
};

export function InviteStatusSection() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const bootstrap = await fetch('/api/workspaces/bootstrap', { method: 'POST' });
        if (!bootstrap.ok) return;
        const data = await bootstrap.json();
        setInvites(data.invites || []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading invite statuses…</p>;
  }

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">No invites yet.</p>;
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => (
        <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
          <div>
            <p className="text-sm text-foreground">{invite.email}</p>
            <p className="text-xs text-muted-foreground">Role: {invite.role}</p>
          </div>
          <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
            {invite.status}
          </span>
        </div>
      ))}
    </div>
  );
}
