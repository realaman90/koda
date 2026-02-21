'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { toast } from 'sonner';

export function CanvasPreferencesSection() {
  const canvasPreferences = useSettingsStore((state) => state.canvasPreferences);
  const setCanvasPreference = useSettingsStore((state) => state.setCanvasPreference);

  const handleChange = <K extends keyof typeof canvasPreferences>(
    key: K,
    value: (typeof canvasPreferences)[K]
  ) => {
    setCanvasPreference(key, value);
    toast.success('Preference saved');
  };

  return (
    <div className="space-y-6">
      {/* Grid Snap */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-foreground">Grid Snap</label>
          <p className="text-xs text-muted-foreground mt-1">
            Snap nodes to grid when moving
          </p>
        </div>
        <button
          onClick={() => handleChange('gridSnap', !canvasPreferences.gridSnap)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            canvasPreferences.gridSnap ? 'bg-indigo-600' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              canvasPreferences.gridSnap ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Show Minimap */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-foreground">Show Minimap</label>
          <p className="text-xs text-muted-foreground mt-1">
            Display a minimap for navigation
          </p>
        </div>
        <button
          onClick={() => handleChange('showMinimap', !canvasPreferences.showMinimap)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            canvasPreferences.showMinimap ? 'bg-indigo-600' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              canvasPreferences.showMinimap ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Auto-save Interval */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Auto-save Interval</label>
        <p className="text-xs text-muted-foreground">
          How often to automatically save your work
        </p>
        <div className="flex gap-2">
          {[
            { value: 0, label: 'Off' },
            { value: 5, label: '5s' },
            { value: 10, label: '10s' },
            { value: 30, label: '30s' },
            { value: 60, label: '1m' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleChange('autoSaveInterval', option.value)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                canvasPreferences.autoSaveInterval === option.value
                  ? 'bg-indigo-600 text-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Default Zoom */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Default Zoom Level</label>
        <p className="text-xs text-muted-foreground">
          Initial zoom when opening a canvas
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0.25"
            max="2"
            step="0.25"
            value={canvasPreferences.defaultZoom}
            onChange={(e) => handleChange('defaultZoom', parseFloat(e.target.value))}
            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
          />
          <span className="text-sm text-foreground w-12 text-right">
            {Math.round(canvasPreferences.defaultZoom * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
