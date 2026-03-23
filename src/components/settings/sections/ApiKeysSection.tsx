'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { toast } from 'sonner';

interface ApiKeyInputProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function ApiKeyInput({ label, description, value, onChange, placeholder }: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const hasValue = value.length > 0;
  const isDirty = localValue !== value;

  const handleSave = () => {
    onChange(localValue);
    toast.success(`${label} saved`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hasValue && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <Check className="h-3 w-3" />
            Configured
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder}
            className="w-full h-10 px-3 pr-10 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            className="px-4 h-10 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}

export function ApiKeysSection() {
  const apiKeys = useSettingsStore((state) => state.apiKeys);
  const setApiKey = useSettingsStore((state) => state.setApiKey);
  const clearApiKeys = useSettingsStore((state) => state.clearApiKeys);

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all API keys?')) {
      clearApiKeys();
      toast.success('All API keys cleared');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-200">
            API keys are stored locally in your browser. They are never sent to our servers.
          </p>
          <p className="text-xs text-amber-500/70 mt-1">
            For production use, consider using environment variables instead.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <ApiKeyInput
          label="Fal.ai API Key"
          description="Required for image and video generation"
          value={apiKeys.falAi}
          onChange={(v) => setApiKey('falAi', v)}
          placeholder="fal_..."
        />

        <ApiKeyInput
          label="Anthropic API Key"
          description="Used for AI agents and prompt enhancement"
          value={apiKeys.anthropic}
          onChange={(v) => setApiKey('anthropic', v)}
          placeholder="sk-ant-..."
        />

        <ApiKeyInput
          label="OpenAI API Key"
          description="Optional fallback for AI features"
          value={apiKeys.openAi}
          onChange={(v) => setApiKey('openAi', v)}
          placeholder="sk-..."
        />
      </div>

      <div className="pt-4 border-t border-border">
        <button
          onClick={handleClearAll}
          className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Clear All API Keys
        </button>
      </div>
    </div>
  );
}
