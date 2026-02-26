/**
 * Prompt Studio Plugin
 *
 * Creative director AI that generates production-quality prompts
 * for image and video generation models. Thinks like a cinematographer —
 * knows camera angles, lenses, lighting rigs, color science, composition.
 *
 * Architecture: Node-based Agent Plugin (renders directly on canvas)
 * Output: Text prompts via output handle → connects to image/video generators
 */

import { Sparkles } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

export const promptStudioPlugin: AgentPlugin = {
  id: 'prompt-studio',
  name: 'Prompt Studio',
  description: 'Creative director AI that crafts production-quality prompts for image and video models',
  icon: Sparkles,
  category: 'planning',
  type: 'agent',
  version: '1.0.0',
  author: {
    type: 'official',
    name: 'Koda Team',
    verified: true,
  },
  visibility: 'public',
  policy: {
    capabilityDeclarations: ['canvas:read'],
    distributionVisibility: ['oss', 'hosted'],
    trustTier: 'official',
  },

  rendering: {
    mode: 'node',
    component: 'PromptStudioNode',
    defaultSize: { width: 420, height: 'auto' },
    resizable: true,
    collapsible: true,
  },

  capabilities: [
    'canvas:read',
  ],

  services: [
    'ai',
  ],

  phases: [
    { id: 'idle', label: 'Ready', initial: true },
    { id: 'generating', label: 'Creating', showProgress: true },
    { id: 'chatting', label: 'Active' },
    { id: 'complete', label: 'Complete', terminal: true },
    { id: 'error', label: 'Error', terminal: true },
  ],

  handles: {
    inputs: [
      { id: 'text', name: 'Brief', type: 'text', optional: true },
    ],
    outputs: [
      { id: 'prompt-output', name: 'Prompt', type: 'text' },
    ],
  },
};

// Register the plugin
pluginRegistry.register(promptStudioPlugin);

// Export types
export * from './types';

// Export components
export { PromptStudioNode } from './PromptStudioNode';

// Export hooks
export { usePromptStudioStream } from './hooks';
