'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { toast } from 'sonner';

import { MODEL_CAPABILITIES, VIDEO_MODEL_CAPABILITIES, ENABLED_IMAGE_MODELS, ENABLED_VIDEO_MODELS, type ImageModelType, type VideoModelType } from '@/lib/types';

const imageModels = [
  { id: 'auto', name: 'Auto', description: 'Best model for the task' },
  ...ENABLED_IMAGE_MODELS.map((id) => ({
    id,
    name: MODEL_CAPABILITIES[id].label,
    description: MODEL_CAPABILITIES[id].description,
  })),
];

const videoModels = [
  { id: 'auto', name: 'Auto', description: 'Best model for the task' },
  ...ENABLED_VIDEO_MODELS.map((id) => ({
    id,
    name: VIDEO_MODEL_CAPABILITIES[id].label,
    description: VIDEO_MODEL_CAPABILITIES[id].description,
  })),
];

const aspectRatios = [
  { id: 'auto', name: 'Auto' },
  { id: '1:1', name: 'Square (1:1)' },
  { id: '16:9', name: 'Landscape (16:9)' },
  { id: '9:16', name: 'Portrait (9:16)' },
  { id: '4:3', name: 'Standard (4:3)' },
  { id: '3:4', name: 'Portrait (3:4)' },
  { id: '21:9', name: 'Cinematic (21:9)' },
];

export function GenerationSettingsSection() {
  const defaultSettings = useSettingsStore((state) => state.defaultSettings);
  const setDefaultSetting = useSettingsStore((state) => state.setDefaultSetting);

  const handleChange = <K extends keyof typeof defaultSettings>(
    key: K,
    value: (typeof defaultSettings)[K]
  ) => {
    setDefaultSetting(key, value);
    toast.success('Setting saved');
  };

  return (
    <div className="space-y-6">
      {/* Image Model */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Default Image Model</label>
        <select
          value={defaultSettings.imageModel}
          onChange={(e) => handleChange('imageModel', e.target.value)}
          className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
        >
          {imageModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      {/* Video Model */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Default Video Model</label>
        <select
          value={defaultSettings.videoModel}
          onChange={(e) => handleChange('videoModel', e.target.value)}
          className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
        >
          {videoModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Default Aspect Ratio</label>
        <select
          value={defaultSettings.aspectRatio}
          onChange={(e) => handleChange('aspectRatio', e.target.value)}
          className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
        >
          {aspectRatios.map((ratio) => (
            <option key={ratio.id} value={ratio.id}>
              {ratio.name}
            </option>
          ))}
        </select>
      </div>

      {/* Image Count */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Default Image Count</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={() => handleChange('imageCount', count)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                defaultSettings.imageCount === count
                  ? 'bg-primary text-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Magic Prompt */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-foreground">Magic Prompt</label>
          <p className="text-xs text-muted-foreground mt-1">
            Automatically enhance prompts with AI
          </p>
        </div>
        <button
          onClick={() => handleChange('magicPrompt', !defaultSettings.magicPrompt)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            defaultSettings.magicPrompt ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              defaultSettings.magicPrompt ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
