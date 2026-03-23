/**
 * Storyboard Generator Plugin
 *
 * Creates a complete storyboard from a concept.
 * Generates multiple ImageGenerator nodes with AI-written prompts.
 */

import { LayoutGrid } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';
import { StoryboardSandbox } from './StoryboardSandbox';

/**
 * Storyboard Generator Plugin Definition
 */
export const storyboardGeneratorPlugin: AgentPlugin = {
  id: 'storyboard-generator',
  name: 'Storyboard Generator',
  description: 'Create a complete storyboard from a concept with AI-generated scene prompts',
  icon: LayoutGrid,
  category: 'planning',
  author: {
    type: 'official',
    name: 'Koda',
    verified: true,
  },
  version: '1.0.0',
  visibility: 'public',
  type: 'agent',
  sandbox: {
    component: StoryboardSandbox,
    size: 'large',
    title: 'Create Storyboard',
  },
  capabilities: ['canvas:create', 'canvas:read'],
  services: ['ai'],
};

// Register the plugin
pluginRegistry.register(storyboardGeneratorPlugin);

// Export for direct import
export { StoryboardSandbox };
