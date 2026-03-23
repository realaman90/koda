'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore, Theme } from '@/stores/settings-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const themes: { id: Theme; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Dark theme for low-light environments',
  },
  {
    id: 'light',
    label: 'Light',
    icon: Sun,
    description: 'Light theme for bright environments',
  },
  {
    id: 'system',
    label: 'System',
    icon: Monitor,
    description: 'Follows your system preference',
  },
];

export function ThemeSection() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    toast.success(`Theme set to ${newTheme}`);
  };

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="grid grid-cols-3 gap-4">
        {themes.map((t) => {
          const Icon = t.icon;
          const isActive = theme === t.id;

          return (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className={cn(
                'flex flex-col items-center gap-3 p-4 rounded-xl border transition-all',
                isActive
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center',
                  isActive ? 'bg-primary/15' : 'bg-muted'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Theme Preview */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <h3 className="text-sm font-medium text-foreground mb-3">Preview</h3>
        <div className="flex gap-4">
          {/* Dark preview - using inline styles to prevent override */}
          <div
            className="flex-1 p-4 rounded-lg"
            style={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
          >
            <div className="w-full h-3 rounded mb-2" style={{ backgroundColor: '#27272a' }} />
            <div className="w-3/4 h-3 rounded mb-2" style={{ backgroundColor: '#27272a' }} />
            <div className="w-1/2 h-3 bg-primary rounded" />
            <p className="text-xs mt-3" style={{ color: '#a1a1aa' }}>Dark Theme</p>
          </div>
          {/* Light preview - using inline styles */}
          <div
            className="flex-1 p-4 rounded-lg"
            style={{ backgroundColor: '#ffffff', border: '1px solid #e4e4e7' }}
          >
            <div className="w-full h-3 rounded mb-2" style={{ backgroundColor: '#e4e4e7' }} />
            <div className="w-3/4 h-3 rounded mb-2" style={{ backgroundColor: '#e4e4e7' }} />
            <div className="w-1/2 h-3 bg-primary rounded" />
            <p className="text-xs mt-3" style={{ color: '#71717a' }}>Light Theme</p>
          </div>
        </div>
      </div>

      {/* Current theme indicator */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
        <div className={cn(
          'w-3 h-3 rounded-full',
          'bg-primary'
        )} />
        <span className="text-sm text-muted-foreground">
          Current theme: <span className="text-foreground font-medium capitalize">{theme}</span>
        </span>
      </div>
    </div>
  );
}
