import { PenTool } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

const SVG_PLUGIN_ENABLED = process.env.NEXT_PUBLIC_SVG_PLUGIN_V1 === 'true';

export const svgStudioPlugin: AgentPlugin = {
  id: 'svg-studio',
  name: 'SVG Studio',
  description: 'Generate and edit animation-ready SVG assets',
  icon: PenTool,
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
    capabilityDeclarations: ['canvas:read', 'storage:upload'],
    distributionVisibility: ['oss', 'hosted'],
    trustTier: 'official',
  },
  rendering: {
    mode: 'node',
    component: 'SvgStudioNode',
    defaultSize: { width: 420, height: 'auto' },
    resizable: true,
    collapsible: true,
  },
  capabilities: ['canvas:read', 'storage:upload'],
  services: ['ai', 'storage'],
  handles: {
    inputs: [
      { id: 'svg-input', name: 'SVG', type: 'image', optional: true },
    ],
    outputs: [
      { id: 'svg-output', name: 'SVG Output', type: 'image' },
    ],
  },
};

if (SVG_PLUGIN_ENABLED) {
  pluginRegistry.register(svgStudioPlugin);
}

export * from './types';
export { SvgStudioNode } from './SvgStudioNode';
