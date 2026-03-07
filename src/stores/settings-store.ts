import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ENABLED_IMAGE_MODELS,
  ENABLED_VIDEO_MODELS,
  resolveDeprecatedVideoModel,
  type ImageModelType,
  type VideoModelType,
} from '@/lib/types';

// Generation history item
export interface GenerationHistoryItem {
  id: string;
  type: 'image' | 'video' | 'svg';
  prompt: string;
  model: string;
  mode?: 'single' | 'compare';
  models?: string[];
  winnerModel?: string;
  timestamp: number;
  status: 'completed' | 'failed';
  result?: {
    urls: string[];
    duration?: number; // for video
  };
  compareResults?: Array<{
    model: string;
    status: 'completed' | 'failed';
    urls?: string[];
    thumbnailUrl?: string;
    error?: string;
  }>;
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
  enabledImageModels: ImageModelType[];
  enabledVideoModels: VideoModelType[];
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
  toggleImageModel: (modelId: ImageModelType) => void;
  toggleVideoModel: (modelId: VideoModelType) => void;

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
  addToHistory: (item: Omit<GenerationHistoryItem, 'id' | 'timestamp'>) => string;
  updateHistoryItem: (id: string, patch: Partial<Omit<GenerationHistoryItem, 'id' | 'timestamp'>>) => void;
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

const LEGACY_DEFAULT_ENABLED_IMAGE: ImageModelType[] = [
  'nanobanana-2',
  'flux-2-pro',
  'flux-kontext',
  'recraft-v4',
  'seedream-5',
  'ideogram-v3',
];

const LEGACY_DEFAULT_ENABLED_VIDEO: VideoModelType[] = [
  'kling-3.0-t2v',
  'kling-3.0-i2v',
  'kling-3.0-pro-t2v',
  'kling-3.0-pro-i2v',
  'veo-3',
  'veo-3.1-i2v',
  'veo-3.1-fast-i2v',
  'wan-2.6-t2v',
  'wan-2.6-i2v',
  'hailuo-02-t2v',
  'hailuo-02-i2v',
];

// Default to all shipped models.
const DEFAULT_ENABLED_IMAGE: ImageModelType[] = [...ENABLED_IMAGE_MODELS];
const DEFAULT_ENABLED_VIDEO: VideoModelType[] = [...ENABLED_VIDEO_MODELS];

function matchesModelSet<T extends string>(actual: T[] | undefined, expected: readonly T[]): boolean {
  if (!actual || actual.length !== expected.length) return false;
  return expected.every((modelId) => actual.includes(modelId));
}

function sanitizeEnabledImageModels(models: ImageModelType[] | undefined): ImageModelType[] {
  if (!models || matchesModelSet(models, LEGACY_DEFAULT_ENABLED_IMAGE)) {
    return [...DEFAULT_ENABLED_IMAGE];
  }

  const next = ENABLED_IMAGE_MODELS.filter((modelId) => models.includes(modelId));
  return next.length > 0 ? next : [...DEFAULT_ENABLED_IMAGE];
}

function sanitizeEnabledVideoModels(models: VideoModelType[] | undefined): VideoModelType[] {
  if (!models || matchesModelSet(models, LEGACY_DEFAULT_ENABLED_VIDEO)) {
    return [...DEFAULT_ENABLED_VIDEO];
  }

  const requested = models.map(resolveDeprecatedVideoModel);
  const next = ENABLED_VIDEO_MODELS.filter((modelId) => requested.includes(modelId));
  return next.length > 0 ? next : [...DEFAULT_ENABLED_VIDEO];
}

function sanitizeDefaultSettings(
  settings: Partial<DefaultGenerationSettings> | undefined
): DefaultGenerationSettings {
  return {
    ...defaultGenerationSettings,
    ...settings,
    videoModel: resolveDeprecatedVideoModel(
      (settings?.videoModel as VideoModelType | undefined) || defaultGenerationSettings.videoModel as VideoModelType
    ),
    enabledImageModels: sanitizeEnabledImageModels(settings?.enabledImageModels),
    enabledVideoModels: sanitizeEnabledVideoModels(settings?.enabledVideoModels),
  };
}

const defaultGenerationSettings: DefaultGenerationSettings = {
  imageModel: 'auto',
  videoModel: 'veo-3.1-fast-i2v',
  aspectRatio: 'auto',
  imageCount: 1,
  magicPrompt: true,
  enabledImageModels: DEFAULT_ENABLED_IMAGE,
  enabledVideoModels: DEFAULT_ENABLED_VIDEO,
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
      toggleImageModel: (modelId) =>
        set((state) => {
          const current = state.defaultSettings.enabledImageModels || DEFAULT_ENABLED_IMAGE;
          const isEnabled = current.includes(modelId);
          // Must keep at least 1 enabled
          if (isEnabled && current.length <= 1) return state;
          const next = isEnabled ? current.filter((m) => m !== modelId) : [...current, modelId];
          return { defaultSettings: { ...state.defaultSettings, enabledImageModels: next } };
        }),
      toggleVideoModel: (modelId) =>
        set((state) => {
          const current = state.defaultSettings.enabledVideoModels || DEFAULT_ENABLED_VIDEO;
          const isEnabled = current.includes(modelId);
          if (isEnabled && current.length <= 1) return state;
          const next = isEnabled ? current.filter((m) => m !== modelId) : [...current, modelId];
          return { defaultSettings: { ...state.defaultSettings, enabledVideoModels: next } };
        }),

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
      addToHistory: (item) => {
        const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          generationHistory: [
            {
              ...item,
              id,
              timestamp: Date.now(),
            },
            ...state.generationHistory,
          ].slice(0, 100), // Keep last 100 items
        }));
        return id;
      },
      updateHistoryItem: (id, patch) =>
        set((state) => ({
          generationHistory: state.generationHistory.map((item) =>
            item.id === id
              ? { ...item, ...patch }
              : item
          ),
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
          defaultSettings: sanitizeDefaultSettings(defaultGenerationSettings),
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
            defaultSettings: sanitizeDefaultSettings(parsed.defaultSettings),
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
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<SettingsState> | undefined;
        return {
          ...currentState,
          ...typedState,
          defaultSettings: sanitizeDefaultSettings(typedState?.defaultSettings),
        };
      },
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
