'use client';

import { motion } from 'framer-motion';
import { Plus, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  onCreateCanvas: () => void;
  memberships: Array<{ workspaceId: string; workspaceName: string; workspaceType: string; role: string }>;
}

export function DashboardHeader({ onCreateCanvas, memberships }: DashboardHeaderProps) {
  return (
    <div className="mb-7 rounded-2xl border border-border/70 bg-gradient-to-br from-card/95 to-card/70 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a new project and start creating</p>
        </div>
        <div className="flex items-center gap-3">
          {memberships.length > 1 && (
            <select className="h-9 rounded-xl border border-border/70 bg-background/80 px-3 text-xs text-foreground">
              {memberships.map((membership) => (
                <option key={membership.workspaceId} value={membership.workspaceId}>
                  {membership.workspaceName} · {membership.workspaceType === 'team' ? 'Team' : 'Personal'}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button onClick={onCreateCanvas} className="h-11 rounded-xl gap-2 px-5 text-sm font-medium shadow-sm">
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </motion.div>

        <div className="hidden items-center gap-1.5 rounded-xl border border-border/70 bg-secondary/60 px-3 py-2 text-xs text-muted-foreground sm:flex">
          <Command className="h-3 w-3" />
          <span>K</span>
        </div>
      </div>
    </div>
  );
}
