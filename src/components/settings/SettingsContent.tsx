'use client';

import { useState } from 'react';
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

export function SettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api-keys');

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
        return null;
    }
  };

  const activeTabInfo = tabs.find((t) => t.id === activeTab);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Settings</h1>

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
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
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-card/50 rounded-xl border border-border p-6">
            {activeTabInfo && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">
                  {activeTabInfo.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTabInfo.description}
                </p>
              </div>
            )}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
