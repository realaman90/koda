'use client';

/**
 * PluginNode Component
 * 
 * Dynamic node renderer that delegates to plugin-defined components.
 * Based on ANIMATION_PLUGIN.md Part 9.6: Canvas Node Rendering
 */

import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Plug } from 'lucide-react';
import type { PluginNodeData } from '@/lib/types';
import { pluginRegistry } from '@/lib/plugins/registry';
import { CanvasNodeShell } from '@/components/canvas/nodes/chrome/CanvasNodeShell';

// Import plugin-defined node components
import { AnimationNode } from '@/lib/plugins/official/agents/animation-generator';
import { MotionAnalyzerNode } from '@/lib/plugins/official/agents/motion-analyzer';
import { SvgStudioNode } from '@/lib/plugins/official/agents/svg-studio';
import { PromptStudioNode } from '@/lib/plugins/official/agents/prompt-studio';
import { ImageToPdfNode } from '@/lib/plugins/official/image-to-pdf';

// Component registry - maps pluginId to component
const PLUGIN_COMPONENTS: Record<string, React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>> = {
  'animation-generator': AnimationNode as unknown as React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>,
  'motion-analyzer': MotionAnalyzerNode as unknown as React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>,
  'svg-studio': SvgStudioNode as unknown as React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>,
  'prompt-studio': PromptStudioNode as unknown as React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>,
  'image-to-pdf': ImageToPdfNode as unknown as React.ComponentType<NodeProps<Node<PluginNodeData, 'pluginNode'>>>,
};

export type PluginNodeType = Node<PluginNodeData, 'pluginNode'>;

interface PluginNodeProps extends NodeProps<PluginNodeType> {}

/**
 * GenericPluginNode - Fallback for unknown plugins
 */
function GenericPluginNodeComponent({ data, selected }: PluginNodeProps) {
  const plugin = pluginRegistry.get(data.pluginId);
  const pluginName = plugin?.name || data.pluginId;
  const PluginIcon = plugin?.icon || Plug;

  return (
    <CanvasNodeShell
      title={pluginName}
      subtitle={data.pluginId}
      icon={
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/60">
          <PluginIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      }
      selected={selected}
      hovered={false}
      displayMode="full"
      interactiveMode="lightweight"
      stageMinHeight={140}
      titleClassName="text-[var(--node-title-default)]"
      cardClassName="w-[320px]"
    >
      <div className="flex min-h-[140px] items-center px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Plugin component not found. The plugin may not be properly registered.
        </p>
      </div>
    </CanvasNodeShell>
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
