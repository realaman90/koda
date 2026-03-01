'use client';

import type { TabType } from './hooks/useDashboardState';

interface DashboardTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <div className="mb-7 inline-flex rounded-xl border border-border/70 bg-card/70 p-1">
      <button
        onClick={() => onChange('my-spaces')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
          activeTab === 'my-spaces'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        }`}
      >
        My projects
      </button>
      <button
        onClick={() => onChange('templates')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
          activeTab === 'templates'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        }`}
      >
        Showcase
      </button>
    </div>
  );
}
