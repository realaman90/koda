'use client';

import type { TabType } from './hooks/useDashboardState';

interface DashboardTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <div className="flex gap-1 mb-6 border-b border-border">
      <button
        onClick={() => onChange('my-spaces')}
        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px] cursor-pointer ${
          activeTab === 'my-spaces'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        My projects
      </button>
      <button
        onClick={() => onChange('shared')}
        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px] cursor-pointer ${
          activeTab === 'shared'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        Shared
      </button>
      <button
        onClick={() => onChange('templates')}
        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px] cursor-pointer ${
          activeTab === 'templates'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        Templates
      </button>
    </div>
  );
}
