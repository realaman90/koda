import { FileOutput } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';
import { ImageToPdfSandbox } from './ImageToPdfSandbox';

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
  sandbox: {
    component: ImageToPdfSandbox,
    size: 'large',
    title: 'Image to PDF',
  },
  launcherHints: {
    input: 'Canvas images or uploads',
    output: 'Downloaded PDF',
  },
  capabilities: ['canvas:read', 'storage:upload'],
  services: ['storage'],
};

pluginRegistry.register(imageToPdfPlugin);

export { ImageToPdfSandbox } from './ImageToPdfSandbox';
