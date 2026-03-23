'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { toast } from 'sonner';

const imageModels = [
  { id: 'flux-schnell', name: 'Flux Schnell', description: 'Fast, good quality' },
  { id: 'flux-pro', name: 'Flux Pro', description: 'High quality, slower' },
  { id: 'nanobanana-pro', name: 'NanoBanana Pro', description: 'Artistic style' },
  { id: 'recraft-v3', name: 'Recraft V3', description: 'Design focused' },
  { id: 'ideogram-v3', name: 'Ideogram V3', description: 'Text rendering' },
  { id: 'sd-3.5', name: 'Stable Diffusion 3.5', description: 'Versatile' },
];

const videoModels = [
  { id: 'kling-2.6-t2v', name: 'Kling 2.6 T2V', description: 'Text to video' },
  { id: 'kling-2.6-i2v', name: 'Kling 2.6 I2V', description: 'Image to video' },
  { id: 'veo-3', name: 'Veo 3', description: 'High quality' },
  { id: 'luma-ray2', name: 'Luma Ray2', description: 'Cinematic' },
  { id: 'minimax-video', name: 'Minimax Video', description: 'Fast generation' },
  { id: 'runway-gen3', name: 'Runway Gen3', description: 'Professional' },
];

const aspectRatios = [
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
        <label className="text-sm font-medium text-zinc-200">Default Image Model</label>
        <select
          value={defaultSettings.imageModel}
          onChange={(e) => handleChange('imageModel', e.target.value)}
          className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 outline-none focus:border-indigo-500"
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
        <label className="text-sm font-medium text-zinc-200">Default Video Model</label>
        <select
          value={defaultSettings.videoModel}
          onChange={(e) => handleChange('videoModel', e.target.value)}
          className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 outline-none focus:border-indigo-500"
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
        <label className="text-sm font-medium text-zinc-200">Default Aspect Ratio</label>
        <select
          value={defaultSettings.aspectRatio}
          onChange={(e) => handleChange('aspectRatio', e.target.value)}
          className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 outline-none focus:border-indigo-500"
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
        <label className="text-sm font-medium text-zinc-200">Default Image Count</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={() => handleChange('imageCount', count)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                defaultSettings.imageCount === count
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Magic Prompt */}
      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-zinc-200">Magic Prompt</label>
          <p className="text-xs text-zinc-500 mt-1">
            Automatically enhance prompts with AI
          </p>
        </div>
        <button
          onClick={() => handleChange('magicPrompt', !defaultSettings.magicPrompt)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            defaultSettings.magicPrompt ? 'bg-indigo-600' : 'bg-zinc-700'
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
