import { Type } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

export const glyphPlugin: AgentPlugin = {
  id: 'glyph',
  name: 'Glyph',
  description: 'Generate styled vector text glyphs from prompts or reference images',
  icon: Type,
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
    component: 'GlyphNode',
    defaultSize: { width: 420, height: 'auto' },
    resizable: true,
    collapsible: true,
  },
  launcherHints: {
    input: 'Text + style description',
    output: 'SVG glyph image + SVG code',
  },
  capabilities: ['canvas:read', 'storage:upload'],
  services: ['ai', 'storage'],
  handles: {
    inputs: [
      { id: 'text', name: 'Text Input', type: 'text', optional: true },
      { id: 'reference', name: 'Image Reference', type: 'image', optional: true },
    ],
    outputs: [
      { id: 'image-output', name: 'Glyph Image Output', type: 'image' },
      { id: 'code-output', name: 'SVG Code Output', type: 'text' },
    ],
  },
};

pluginRegistry.register(glyphPlugin);

export * from './types';
export { GlyphNode } from './GlyphNode';
