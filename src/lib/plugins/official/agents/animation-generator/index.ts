/**
 * Animation Generator Plugin
 *
 * Creates Theatre.js animations from natural language descriptions.
 * Uses a multi-phase workflow: Idle -> Question -> Plan -> Executing -> Preview -> Complete
 * 
 * Architecture: Node-based Agent Plugin (renders directly on canvas)
 * Spec Reference: docs/ANIMATION_PLUGIN.md Part 9
 */

import { Film } from 'lucide-react';
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';

/**
 * Animation Generator Plugin Definition
 * Based on spec Part 9.3
 */
export const animationGeneratorPlugin: AgentPlugin = {
  id: 'animation-generator',
  name: 'Animation Generator',
  description: 'Create Theatre.js animations from text descriptions',
  icon: Film,
  category: 'planning',
  type: 'agent',
  version: '1.0.0',
  author: {
    type: 'official',
    name: 'Koda Team',
    verified: true,
  },
  visibility: 'public',

  // ─────────────────────────────────────────────────────────────
  // RENDERING: Node-based (renders directly on canvas)
  // ─────────────────────────────────────────────────────────────
  rendering: {
    mode: 'node',
    component: 'AnimationNode',
    defaultSize: { width: 420, height: 'auto' },
    resizable: true,
    collapsible: true,
  },

  // ─────────────────────────────────────────────────────────────
  // CAPABILITIES: What this plugin can do
  // ─────────────────────────────────────────────────────────────
  capabilities: [
    'canvas:read',           // Read connected input nodes
    'storage:upload',        // Upload rendered videos
    'sandbox:persistent',    // Long-running sandbox with state
  ],

  // ─────────────────────────────────────────────────────────────
  // SERVICES: What infrastructure it needs
  // ─────────────────────────────────────────────────────────────
  services: [
    'ai',                    // Claude for planning/code generation
    'theatre-sandbox',       // Theatre.js sandbox environment
    'render',                // Puppeteer + FFmpeg pipeline
    'storage',               // Video/asset storage
  ],

  // ─────────────────────────────────────────────────────────────
  // SANDBOX: Persistent Theatre.js environment
  // ─────────────────────────────────────────────────────────────
  sandboxConfig: {
    type: 'theatre',
    template: 'koda-animation-sandbox',  // Docker image or E2B template
    timeout: 1800,                       // 30 min max lifetime
    checkpointInterval: 30,              // Sync every 30 seconds
    idleTimeout: 300,                    // Destroy after 5 min idle
    resources: {
      cpu: 2,
      memory: '4GB',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // PHASES: Multi-step workflow states
  // ─────────────────────────────────────────────────────────────
  phases: [
    { id: 'idle', label: 'Ready', initial: true },
    { id: 'question', label: 'Style Selection', skippable: true },
    { id: 'plan', label: 'Planning', requiresApproval: true },
    { id: 'executing', label: 'Creating', showProgress: true },
    { id: 'preview', label: 'Preview', requiresApproval: true },
    { id: 'complete', label: 'Complete', terminal: true },
    { id: 'error', label: 'Error', terminal: true },
  ],

  // ─────────────────────────────────────────────────────────────
  // HANDLES: Canvas input/output connections
  // ─────────────────────────────────────────────────────────────
  handles: {
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'text', required: true },
      { id: 'style', name: 'Style', type: 'text', optional: true },
      { id: 'assets', name: 'Assets', type: 'media', multiple: true, optional: true },
    ],
    outputs: [
      { id: 'video', name: 'Video', type: 'video' },
      { id: 'thumbnail', name: 'Thumbnail', type: 'image' },
    ],
  },
};

// Register the plugin
pluginRegistry.register(animationGeneratorPlugin);

// Export types
export * from './types';

// Export components
export { AnimationNode } from './AnimationNode';

// Export hooks
export { useAnimationStream } from './hooks';
