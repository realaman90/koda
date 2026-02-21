'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Key,
  Sliders,
  HardDrive,
  History,
  Layout,
  Palette,
  Keyboard,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiKeysSection } from './sections/ApiKeysSection';
import { GenerationSettingsSection } from './sections/GenerationSettingsSection';
import { StorageSection } from './sections/StorageSection';
import { HistorySection } from './sections/HistorySection';
import { CanvasPreferencesSection } from './sections/CanvasPreferencesSection';
import { ThemeSection } from './sections/ThemeSection';
import { KeyboardShortcutsSection } from './sections/KeyboardShortcutsSection';
import { ProfileSection } from './sections/ProfileSection';

type SettingsTab =
  | 'api-keys'
  | 'generation'
  | 'storage'
  | 'history'
  | 'canvas'
  | 'theme'
  | 'shortcuts'
  | 'profile';

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const tabs: TabItem[] = [
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: Key,
    description: 'Manage your API keys for AI services',
  },
  {
    id: 'generation',
    label: 'Generation Defaults',
    icon: Sliders,
    description: 'Default settings for image and video generation',
  },
  {
    id: 'history',
    label: 'Generation History',
    icon: History,
    description: 'View your past generations',
  },
  {
    id: 'canvas',
    label: 'Canvas Preferences',
    icon: Layout,
    description: 'Customize your canvas experience',
  },
  {
    id: 'theme',
    label: 'Appearance',
    icon: Palette,
    description: 'Theme and visual settings',
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Keyboard,
    description: 'View available keyboard shortcuts',
  },
  {
    id: 'storage',
    label: 'Storage & Data',
    icon: HardDrive,
    description: 'Manage local storage and export data',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    description: 'Your account information',
  },
];

const defaultTab: SettingsTab = 'api-keys';
const tabSet = new Set<SettingsTab>(tabs.map((t) => t.id));

function parseTab(tabParam: string | null): SettingsTab {
  if (tabParam && tabSet.has(tabParam as SettingsTab)) {
    return tabParam as SettingsTab;
  }
  return defaultTab;
}

export function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = parseTab(searchParams.get('tab'));

  const renderContent = () => {
    switch (activeTab) {
      case 'api-keys':
        return <ApiKeysSection />;
      case 'generation':
        return <GenerationSettingsSection />;
      case 'storage':
        return <StorageSection />;
      case 'history':
        return <HistorySection />;
      case 'canvas':
        return <CanvasPreferencesSection />;
      case 'theme':
        return <ThemeSection />;
      case 'shortcuts':
        return <KeyboardShortcutsSection />;
      case 'profile':
        return <ProfileSection />;
      default:
        return <ApiKeysSection />;
    }
  };

  const setActiveTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/settings?${params.toString()}`);
  };

  const activeTabInfo = useMemo(() => tabs.find((t) => t.id === activeTab), [activeTab]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">Settings</h1>

      <div className="flex gap-8">
        <nav className="w-64 flex-shrink-0">
          <ul className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-colors',
                      'flex items-center gap-3',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <div className="rounded-xl border border-border bg-card/50 p-6">
            {activeTabInfo && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">{activeTabInfo.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{activeTabInfo.description}</p>
              </div>
            )}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
