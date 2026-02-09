'use client';

/**
 * PluginNode Component
 * 
 * Dynamic node renderer that delegates to plugin-defined components.
 * Based on ANIMATION_PLUGIN.md Part 9.6: Canvas Node Rendering
 */

import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { PluginNodeData } from '@/lib/types';
import { pluginRegistry } from '@/lib/plugins/registry';

// Import plugin-defined node components
import { AnimationNode } from '@/lib/plugins/official/agents/animation-generator';

// Component registry - maps pluginId to component
const PLUGIN_COMPONENTS: Record<string, React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>> = {
  'animation-generator': AnimationNode as unknown as React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>,
  // Future plugins:
  // 'brand-extractor': BrandExtractorNode,
  // 'code-sandbox': CodeSandboxNode,
};

export type PluginNodeType = Node<PluginNodeData, 'pluginNode'>;

interface PluginNodeProps extends NodeProps<PluginNodeType> {}

/**
 * GenericPluginNode - Fallback for unknown plugins
 */
function GenericPluginNodeComponent({ id, data }: PluginNodeProps) {
  const plugin = pluginRegistry.get(data.pluginId);
  const pluginName = plugin?.name || data.pluginId;
  const pluginIcon = plugin?.icon || '🔌';

  return (
    <div className="w-[320px] rounded-2xl bg-zinc-900 border-2 border-zinc-700 overflow-hidden shadow-xl">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-zinc-800">
        <div className="h-8 w-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-lg">
          {pluginIcon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-100">{pluginName}</h3>
          <p className="text-xs text-zinc-500">{data.pluginId}</p>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-zinc-400">
          Plugin component not found. The plugin may not be properly registered.
        </p>
      </div>
    </div>
  );
}

const GenericPluginNode = memo(GenericPluginNodeComponent);

/**
 * PluginNode - Main component
 * Delegates rendering to plugin-specific components
 */
function PluginNodeComponent(props: PluginNodeProps) {
  const { data } = props;
  const Component = PLUGIN_COMPONENTS[data.pluginId];

  if (!Component) {
    return <GenericPluginNode {...props} />;
  }

  return <Component {...props} />;
}

export const PluginNode = memo(PluginNodeComponent);
