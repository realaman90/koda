import { PenTool } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

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
  launcherHints: {
    input: 'Text + image reference',
    output: 'SVG image + SVG code',
  },
  capabilities: ['canvas:read', 'storage:upload'],
  services: ['ai', 'storage'],
  handles: {
    inputs: [
      { id: 'text', name: 'Text Input', type: 'text', optional: true },
      { id: 'reference', name: 'Image Reference', type: 'image', optional: true },
    ],
    outputs: [
      { id: 'image-output', name: 'SVG Image Output', type: 'image' },
      { id: 'code-output', name: 'SVG Code Output', type: 'text' },
    ],
  },
};

pluginRegistry.register(svgStudioPlugin);

export * from './types';
export { SvgStudioNode } from './SvgStudioNode';
