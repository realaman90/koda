'use client';

import { useState, useRef } from 'react';
import { Download, Upload, Trash2, HardDrive, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { toast } from 'sonner';

export function StorageSection() {
  const exportData = useSettingsStore((state) => state.exportData);
  const importData = useSettingsStore((state) => state.importData);
  const clearAllData = useSettingsStore((state) => state.clearAllData);
  const [storageInfo, setStorageInfo] = useState<{ used: string; available: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate storage usage
  useState(() => {
    if (typeof window !== 'undefined') {
      const used = new Blob([JSON.stringify(localStorage)]).size;
      const usedMB = (used / (1024 * 1024)).toFixed(2);
      setStorageInfo({ used: `${usedMB} MB`, available: '5 MB' });
    }
  });

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spaces-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Settings exported');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importData(content);
      if (success) {
        toast.success('Settings imported successfully');
      } else {
        toast.error('Failed to import settings - invalid file format');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear ALL data? This includes your API keys, preferences, and generation history. This cannot be undone.')) {
      clearAllData();
      toast.success('All data cleared');
    }
  };

  const handleClearLocalStorage = () => {
    if (confirm('This will clear ALL localStorage data for this app, including your projects. Are you absolutely sure?')) {
      localStorage.clear();
      toast.success('All local storage cleared. Refreshing...');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage Info */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Local Storage</span>
        </div>
        {storageInfo && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="text-foreground">{storageInfo.used}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(parseFloat(storageInfo.used) / 5 * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Browser localStorage limit is typically 5-10 MB
            </p>
          </div>
        )}
      </div>

      {/* Export/Import */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Backup & Restore</h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 h-12 bg-muted hover:bg-muted text-foreground rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Export Settings</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 h-12 bg-muted hover:bg-muted text-foreground rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span className="text-sm font-medium">Import Settings</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground">
          Export your settings, API keys, and generation history to a JSON file.
          Import to restore on another device or after clearing data.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleClearAll}
            className="w-full flex items-center justify-center gap-2 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">Clear Settings & History</span>
          </button>

          <button
            onClick={handleClearLocalStorage}
            className="w-full flex items-center justify-center gap-2 h-10 border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">Clear All Local Data (Including Projects)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
