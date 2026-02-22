'use client';

import { motion } from 'framer-motion';
import { Plus, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface DashboardHeaderProps {
  onCreateCanvas: () => void;
  memberships: Array<{ workspaceId: string; workspaceName: string; workspaceType: string; role: string }>;
}

export function DashboardHeader({ onCreateCanvas, memberships }: DashboardHeaderProps) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Create a new project and start creating</p>
        <div className="flex items-center gap-2">
          <select className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
            {memberships.map((membership) => (
              <option key={membership.workspaceId} value={membership.workspaceId}>
                {membership.workspaceName} · {membership.workspaceType === 'team' ? 'Team' : 'Personal'}
              </option>
            ))}
          </select>
          <SyncStatusIndicator />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button onClick={onCreateCanvas} className="h-10 gap-2 px-5 text-sm font-medium">
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </motion.div>

        <div className="hidden items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground sm:flex">
          <Command className="h-3 w-3" />
          <span>K</span>
        </div>
      </div>
    </div>
  );
}
