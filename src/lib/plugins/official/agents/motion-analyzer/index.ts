/**
 * Motion Analyzer Plugin
 *
 * Analyzes video motion design and generates animation prompts.
 * Chat-based workflow: upload video → analyze → refine → get prompt.
 */

import { Eye } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

export const motionAnalyzerPlugin: AgentPlugin = {
  id: 'motion-analyzer',
  name: 'Motion Analyzer',
  description: 'Analyze video motion design and generate animation prompts',
  icon: Eye,
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
    component: 'MotionAnalyzerNode',
    defaultSize: { width: 400, height: 'auto' },
    resizable: true,
    collapsible: true,
  },

  launcherHints: {
    input: 'Upload video inside node',
    output: 'Animation prompt text',
  },

  capabilities: [
    'canvas:read',
  ],

  services: [
    'ai',
  ],

  phases: [
    { id: 'idle', label: 'Ready', initial: true },
    { id: 'analyzing', label: 'Analyzing', showProgress: true },
    { id: 'chatting', label: 'Chatting' },
    { id: 'complete', label: 'Complete', terminal: true },
    { id: 'error', label: 'Error', terminal: true },
  ],

  handles: {
    inputs: [],
    outputs: [],
  },
};

// Register the plugin
pluginRegistry.register(motionAnalyzerPlugin);

// Export types
export * from './types';

// Export components
export { MotionAnalyzerNode } from './MotionAnalyzerNode';

// Export hooks
export { useMotionAnalyzerStream } from './hooks';
