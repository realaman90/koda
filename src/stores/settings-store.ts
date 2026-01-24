import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Generation history item
export interface GenerationHistoryItem {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  model: string;
  timestamp: number;
  status: 'completed' | 'failed';
  result?: {
    urls: string[];
    duration?: number; // for video
  };
  settings?: {
    aspectRatio?: string;
    resolution?: string;
    imageCount?: number;
    [key: string]: unknown;
  };
  error?: string;
}

// API Keys (stored encrypted in production)
export interface ApiKeys {
  falAi: string;
  anthropic: string;
  openAi: string;
}

// Default generation settings
export interface DefaultGenerationSettings {
  imageModel: string;
  videoModel: string;
  aspectRatio: string;
  imageCount: number;
  magicPrompt: boolean;
}

// Canvas preferences
export interface CanvasPreferences {
  gridSnap: boolean;
  autoSaveInterval: number; // in seconds, 0 = disabled
  defaultZoom: number;
  showMinimap: boolean;
}

// Theme
export type Theme = 'dark' | 'light' | 'system';

interface SettingsState {
  // API Keys
  apiKeys: ApiKeys;
  setApiKey: (key: keyof ApiKeys, value: string) => void;
  clearApiKeys: () => void;

  // Default Generation Settings
  defaultSettings: DefaultGenerationSettings;
  setDefaultSetting: <K extends keyof DefaultGenerationSettings>(
    key: K,
    value: DefaultGenerationSettings[K]
  ) => void;

  // Canvas Preferences
  canvasPreferences: CanvasPreferences;
  setCanvasPreference: <K extends keyof CanvasPreferences>(
    key: K,
    value: CanvasPreferences[K]
  ) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Generation History
  generationHistory: GenerationHistoryItem[];
  addToHistory: (item: Omit<GenerationHistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;

  // Storage
  clearAllData: () => void;
  exportData: () => string;
  importData: (data: string) => boolean;
}

const defaultApiKeys: ApiKeys = {
  falAi: '',
  anthropic: '',
  openAi: '',
};

const defaultGenerationSettings: DefaultGenerationSettings = {
  imageModel: 'flux-schnell',
  videoModel: 'kling-2.6-t2v',
  aspectRatio: '1:1',
  imageCount: 1,
  magicPrompt: true,
};

const defaultCanvasPreferences: CanvasPreferences = {
  gridSnap: false,
  autoSaveInterval: 5,
  defaultZoom: 1,
  showMinimap: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // API Keys
      apiKeys: defaultApiKeys,
      setApiKey: (key, value) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [key]: value },
        })),
      clearApiKeys: () => set({ apiKeys: defaultApiKeys }),

      // Default Generation Settings
      defaultSettings: defaultGenerationSettings,
      setDefaultSetting: (key, value) =>
        set((state) => ({
          defaultSettings: { ...state.defaultSettings, [key]: value },
        })),

      // Canvas Preferences
      canvasPreferences: defaultCanvasPreferences,
      setCanvasPreference: (key, value) =>
        set((state) => ({
          canvasPreferences: { ...state.canvasPreferences, [key]: value },
        })),

      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // Generation History
      generationHistory: [],
      addToHistory: (item) =>
        set((state) => ({
          generationHistory: [
            {
              ...item,
              id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              timestamp: Date.now(),
            },
            ...state.generationHistory,
          ].slice(0, 100), // Keep last 100 items
        })),
      clearHistory: () => set({ generationHistory: [] }),
      removeFromHistory: (id) =>
        set((state) => ({
          generationHistory: state.generationHistory.filter((item) => item.id !== id),
        })),

      // Storage
      clearAllData: () => {
        set({
          apiKeys: defaultApiKeys,
          defaultSettings: defaultGenerationSettings,
          canvasPreferences: defaultCanvasPreferences,
          theme: 'dark',
          generationHistory: [],
        });
      },
      exportData: () => {
        const state = get();
        return JSON.stringify({
          apiKeys: state.apiKeys,
          defaultSettings: state.defaultSettings,
          canvasPreferences: state.canvasPreferences,
          theme: state.theme,
          generationHistory: state.generationHistory,
          exportedAt: Date.now(),
        }, null, 2);
      },
      importData: (data) => {
        try {
          const parsed = JSON.parse(data);
          set({
            apiKeys: parsed.apiKeys || defaultApiKeys,
            defaultSettings: parsed.defaultSettings || defaultGenerationSettings,
            canvasPreferences: parsed.canvasPreferences || defaultCanvasPreferences,
            theme: parsed.theme || 'dark',
            generationHistory: parsed.generationHistory || [],
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'spaces-settings-storage',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        defaultSettings: state.defaultSettings,
        canvasPreferences: state.canvasPreferences,
        theme: state.theme,
        generationHistory: state.generationHistory,
      }),
    }
  )
);
