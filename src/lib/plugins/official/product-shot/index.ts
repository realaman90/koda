/**
 * Product Shot Plugin
 *
 * Generates optimal product photography shot plans from a product image.
 * Creates multiple ImageGenerator nodes with AI-written prompts for each angle.
 */

import { Camera } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';
import { ProductShotSandbox } from './ProductShotSandbox';

/**
 * Product Shot Plugin Definition
 */
export const productShotPlugin: AgentPlugin = {
  id: 'product-shot',
  name: 'Product Shots',
  description: 'Generate professional product photography shots from multiple angles',
  icon: Camera,
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
    component: ProductShotSandbox,
    size: 'large',
    title: 'Product Shots',
  },
  capabilities: ['canvas:create', 'canvas:read'],
  services: ['ai'],
};

// Register the plugin
pluginRegistry.register(productShotPlugin);

// Export for direct import
export { ProductShotSandbox };
