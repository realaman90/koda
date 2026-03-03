import { FileOutput } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';
import { ImageToPdfNode } from './ImageToPdfNode';

export const imageToPdfPlugin: AgentPlugin = {
  id: 'image-to-pdf',
  name: 'Image to PDF',
  description: 'Convert ordered canvas images into a single PDF file',
  icon: FileOutput,
  category: 'export',
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
    component: 'ImageToPdfNode',
    defaultSize: { width: 420, height: 'auto' },
    resizable: true,
    collapsible: true,
  },
  launcherHints: {
    input: 'Canvas images or uploads',
    output: 'Downloaded PDF',
  },
  handles: {
    inputs: [
      { id: 'reference', name: 'Image Input', type: 'image', optional: true, multiple: true },
    ],
    outputs: [],
  },
  capabilities: ['canvas:read', 'storage:upload'],
  services: ['storage'],
};

pluginRegistry.register(imageToPdfPlugin);

export { ImageToPdfNode } from './ImageToPdfNode';
