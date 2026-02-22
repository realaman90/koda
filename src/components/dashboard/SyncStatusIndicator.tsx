'use client';

import { useAppStore } from '@/stores/app-store';
import { Cloud, CloudOff, Loader2, Check, AlertCircle, HardDrive } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function SyncStatusIndicator() {
  const syncStatus = useAppStore((state) => state.syncStatus);
  const syncError = useAppStore((state) => state.syncError);
  const isSyncEnabled = useAppStore((state) => state.isSyncEnabled);
  const syncCapability = useAppStore((state) => state.syncCapability);

  if (!isSyncEnabled) {
    const label = syncCapability === 'provisioning-blocked' ? 'Sync blocked' : 'Local-only';
    const tooltip =
      syncCapability === 'provisioning-blocked'
        ? syncError || 'Authenticated, but account provisioning is not complete yet.'
        : 'Database sync is unavailable; saving to browser storage only.';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'syncing':
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: 'Syncing...',
          tooltip: 'Saving to database...',
          className: 'text-blue-500',
        };
      case 'synced':
        return {
          icon: <Check className="h-3.5 w-3.5" />,
          text: 'Synced',
          tooltip: 'All changes saved to database',
          className: 'text-green-500',
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: 'Error',
          tooltip: syncError || 'Sync failed',
          className: 'text-red-500',
        };
      case 'offline':
        return {
          icon: <CloudOff className="h-3.5 w-3.5" />,
          text: 'Offline',
          tooltip: 'Working offline, will sync when connected',
          className: 'text-yellow-500',
        };
      default:
        return {
          icon: <Cloud className="h-3.5 w-3.5" />,
          text: 'DB ready',
          tooltip: 'Database sync is available',
          className: 'text-muted-foreground',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 text-xs ${config.className}`}>
            {config.icon}
            <span>{config.text}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
