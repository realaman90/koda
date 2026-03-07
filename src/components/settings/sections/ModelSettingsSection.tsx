'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import {
  MODEL_CAPABILITIES,
  VIDEO_MODEL_CAPABILITIES,
  ENABLED_IMAGE_MODELS,
  ENABLED_VIDEO_MODELS,
  IMAGE_MODEL_CREDITS,
  VIDEO_MODEL_CREDITS,
  type ImageModelType,
  type VideoModelType,
} from '@/lib/types';
import { toast } from 'sonner';

// Group definitions for image models
const IMAGE_MODEL_GROUPS: { label: string; models: ImageModelType[] }[] = [
  { label: 'Flux', models: ['flux-schnell', 'flux-pro', 'flux-2-pro', 'flux-2-max', 'flux-kontext'] },
  { label: 'Nano Banana', models: ['nanobanana-pro', 'nanobanana-2'] },
  { label: 'Qwen', models: ['qwen-image-2', 'qwen-image-2-pro'] },
  { label: 'Other', models: ['seedream-5', 'recraft-v3', 'recraft-v4', 'ideogram-v3', 'sd-3.5'] },
];

// Group definitions for video models
const VIDEO_MODEL_GROUPS: { label: string; models: VideoModelType[] }[] = [
  { label: 'Google Veo', models: ['veo-3', 'veo-3.1-i2v', 'veo-3.1-fast-i2v', 'veo-3.1-ref', 'veo-3.1-flf', 'veo-3.1-fast-flf'] },
  { label: 'Vidu', models: ['vidu-q3-t2v', 'vidu-q3-i2v', 'vidu-q3-t2v-turbo', 'vidu-q3-i2v-turbo'] },
  { label: 'Sora 2', models: ['sora-2-t2v', 'sora-2-i2v', 'sora-2-pro-i2v', 'sora-2-remix-v2v'] },
  { label: 'xAI Grok', models: ['grok-imagine-t2v', 'grok-imagine-i2v', 'grok-imagine-edit-v2v'] },
  { label: 'LTX', models: ['ltx-2-19b-t2v', 'ltx-2-19b-i2v', 'ltx-2-19b-v2v', 'ltx-2-19b-extend', 'ltx-2-19b-a2v'] },
  { label: 'Kling', models: ['kling-2.6-t2v', 'kling-2.6-i2v', 'kling-o3-t2v', 'kling-o3-i2v', 'kling-o3-pro-i2v', 'kling-3.0-t2v', 'kling-3.0-i2v', 'kling-3.0-pro-t2v', 'kling-3.0-pro-i2v'] },
  { label: 'Seedance', models: ['seedance-1.5-t2v', 'seedance-1.5-i2v', 'seedance-1.0-pro-t2v', 'seedance-1.0-pro-i2v'] },
  { label: 'Wan', models: ['wan-2.6-t2v', 'wan-2.6-i2v'] },
  { label: 'Hailuo', models: ['hailuo-02-t2v', 'hailuo-02-i2v', 'hailuo-2.3-t2v', 'hailuo-2.3-i2v'] },
  { label: 'Other', models: ['luma-ray2', 'minimax-video', 'veed-fabric-1.0', 'heygen-avatar4-i2v'] },
];

type Tab = 'image' | 'video';

function CreditChip({ credits }: { credits: number }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
      {credits} {credits === 1 ? 'credit' : 'credits'}
    </span>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'left-5.5' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function ModelSettingsSection() {
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const defaultSettings = useSettingsStore((s) => s.defaultSettings);
  const toggleImageModel = useSettingsStore((s) => s.toggleImageModel);
  const toggleVideoModel = useSettingsStore((s) => s.toggleVideoModel);

  const enabledImageModels = defaultSettings.enabledImageModels || [...ENABLED_IMAGE_MODELS];
  const enabledVideoModels = defaultSettings.enabledVideoModels || [...ENABLED_VIDEO_MODELS];

  const handleToggleImage = (modelId: ImageModelType) => {
    toggleImageModel(modelId);
    toast.success('Setting saved');
  };

  const handleToggleVideo = (modelId: VideoModelType) => {
    toggleVideoModel(modelId);
    toast.success('Setting saved');
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'image'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Image Models
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'video'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Video Models
        </button>
      </div>

      {/* Auto row */}
      <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div>
          <p className="text-sm font-medium text-foreground">Auto</p>
          <p className="text-xs text-muted-foreground">
            {activeTab === 'image'
              ? 'Defaults to Nano Banana 2 \u2014 best balance of speed and quality'
              : 'Defaults to Kling 3.0 \u2014 balanced speed, quality, and availability'}
          </p>
        </div>
        <span className="text-xs text-primary font-medium px-2 py-0.5 bg-primary/10 rounded">Always on</span>
      </div>

      {/* Model groups */}
      {activeTab === 'image' ? (
        <div className="space-y-6">
          {IMAGE_MODEL_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.models.map((modelId) => {
                  const caps = MODEL_CAPABILITIES[modelId];
                  if (!caps) return null;
                  const isEnabled = enabledImageModels.includes(modelId);
                  const credits = IMAGE_MODEL_CREDITS[modelId];
                  return (
                    <div
                      key={modelId}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{caps.label}</p>
                          {credits != null && <CreditChip credits={credits} />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{caps.description}</p>
                      </div>
                      <Toggle enabled={isEnabled} onToggle={() => handleToggleImage(modelId)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {VIDEO_MODEL_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.models.map((modelId) => {
                  const caps = VIDEO_MODEL_CAPABILITIES[modelId];
                  if (!caps) return null;
                  const isEnabled = enabledVideoModels.includes(modelId);
                  const credits = VIDEO_MODEL_CREDITS[modelId];
                  return (
                    <div
                      key={modelId}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{caps.label}</p>
                          {credits != null && <CreditChip credits={credits} />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{caps.description}</p>
                      </div>
                      <Toggle enabled={isEnabled} onToggle={() => handleToggleVideo(modelId)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
