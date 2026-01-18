'use client';

import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  SelectionMode,
  type OnSelectionChangeFunc,
  type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, createStoryboardNode } from '@/stores/canvas-store';
import type { AppNode, ImageGeneratorNodeData, VideoGeneratorNodeData, ImageModelType, VideoModelType } from '@/lib/types';
import { MODEL_CAPABILITIES, VIDEO_MODEL_CAPABILITIES } from '@/lib/types';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { NodeToolbar } from './NodeToolbar';
import { WelcomeOverlay } from './WelcomeOverlay';
import { SettingsPanel } from './SettingsPanel';
import { VideoSettingsPanel } from './VideoSettingsPanel';
import { ContextMenu } from './ContextMenu';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ZoomControls } from './ZoomControls';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAgentSandbox } from '@/hooks/useAgentSandbox';
import { AgentSandbox } from '@/components/plugins/AgentSandbox';

export function Canvas() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const setSelectedNodes = useCanvasStore((state) => state.setSelectedNodes);
  const setSelectedEdges = useCanvasStore((state) => state.setSelectedEdges);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const showContextMenu = useCanvasStore((state) => state.showContextMenu);
  const hideContextMenu = useCanvasStore((state) => state.hideContextMenu);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const deleteSelectedEdges = useCanvasStore((state) => state.deleteSelectedEdges);
  const selectedEdgeIds = useCanvasStore((state) => state.selectedEdgeIds);
  const setReactFlowInstance = useCanvasStore((state) => state.setReactFlowInstance);

  // Plugin sandbox state
  const { activePlugin, openSandbox, closeSandbox } = useAgentSandbox();

  // Get addNode and reactFlowInstance for creating nodes
  const addNode = useCanvasStore((state) => state.addNode);
  const reactFlowInstance = useCanvasStore((state) => state.reactFlowInstance);

  // Handle plugin launch - create node for storyboard, open sandbox for others
  const handlePluginLaunch = useCallback(
    (pluginId: string) => {
      if (pluginId === 'storyboard-generator') {
        // Create a storyboard node at viewport center
        let position = { x: 400, y: 300 };
        if (reactFlowInstance) {
          const viewport = reactFlowInstance.getViewport();
          const width = window.innerWidth;
          const height = window.innerHeight;
          position = {
            x: (-viewport.x + width / 2 - 200) / viewport.zoom,
            y: (-viewport.y + height / 2 - 200) / viewport.zoom,
          };
        }
        const node = createStoryboardNode(position, 'Storyboard');
        addNode(node);
      } else {
        // Other plugins still open as modals
        openSandbox(pluginId);
      }
    },
    [addNode, openSandbox, reactFlowInstance]
  );

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const type = selectedNodeIds.length > 0 ? 'node' : 'canvas';
      showContextMenu(event.clientX, event.clientY, type);
    },
    [selectedNodeIds, showContextMenu]
  );

  // Hide context menu on pane click
  const handlePaneClick = useCallback(() => {
    hideContextMenu();
  }, [hideContextMenu]);

  // Sync React Flow selection with store
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      setSelectedNodes(selectedNodes.map((n) => n.id));
      setSelectedEdges(selectedEdges.map((e) => e.id));
    },
    [setSelectedNodes, setSelectedEdges]
  );

  // Handle selection end in scissors mode - cut selected edges
  const onSelectionEnd = useCallback(() => {
    if (activeTool === 'scissors' && selectedEdgeIds.length > 0) {
      // Small delay to ensure selection state is updated
      setTimeout(() => {
        deleteSelectedEdges();
        setActiveTool('pan');
      }, 50);
    }
  }, [activeTool, selectedEdgeIds.length, deleteSelectedEdges, setActiveTool]);

  // Validate connections based on handle types and model capabilities
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      // Prevent self-connections
      if (connection.source === connection.target) {
        return false;
      }

      // Get source and target nodes
      const sourceNode = nodes.find((n) => n.id === connection.source) as AppNode | undefined;
      const targetNode = nodes.find((n) => n.id === connection.target) as AppNode | undefined;
      if (!sourceNode || !targetNode) return false;

      // Check if source provides images (media nodes or imageGenerator output)
      const isImageSource = sourceNode.type === 'media' || sourceNode.type === 'imageGenerator';

      // Image input handles - reference, firstFrame, lastFrame, ref2-ref8 (for multi-ref models)
      const targetHandle = connection.targetHandle || '';
      const isImageHandle = ['reference', 'firstFrame', 'lastFrame'].includes(targetHandle) ||
        /^ref[2-8]$/.test(targetHandle);
      if (isImageHandle) {
        if (!isImageSource) return false;

        // For image generator nodes
        if (targetNode.type === 'imageGenerator') {
          const model = (targetNode.data as ImageGeneratorNodeData).model as ImageModelType;
          const capabilities = MODEL_CAPABILITIES[model];
          return capabilities.inputType === 'text-and-image' || capabilities.inputType === 'image-only';
        }

        // For video generator nodes - always allow if it's an image handle
        if (targetNode.type === 'videoGenerator') {
          return true;
        }
        return false;
      }

      // Storyboard node image handles (productImage, characterImage)
      if (targetNode.type === 'storyboard') {
        const storyboardImageHandles = ['productImage', 'characterImage'];
        if (storyboardImageHandles.includes(targetHandle)) {
          return isImageSource;
        }
      }

      // Text handle only accepts text nodes
      if (connection.targetHandle === 'text') {
        return sourceNode.type === 'text';
      }

      return true;
    },
    [nodes]
  );

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--canvas-bg)' }}>
      <NodeToolbar onPluginLaunch={handlePluginLaunch} />
      <WelcomeOverlay />
      <SettingsPanel />
      <VideoSettingsPanel />
      <ContextMenu onPluginLaunch={handlePluginLaunch} />
      <KeyboardShortcuts />
      {activePlugin && (
        <AgentSandbox plugin={activePlugin} onClose={closeSandbox} />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onSelectionEnd={onSelectionEnd}
        onPaneClick={handlePaneClick}
        onContextMenu={handleContextMenu}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        fitView
        className={`tool-${activeTool}`}
        style={{ backgroundColor: 'var(--canvas-bg)' }}
        defaultEdgeOptions={{
          style: { stroke: '#6366f1', strokeWidth: 2 },
          type: 'deletable',
        }}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
        snapToGrid
        snapGrid={[20, 20]}
        panOnDrag={activeTool === 'pan'}
        panOnScroll={false}
        zoomOnScroll
        selectionOnDrag={activeTool === 'select' || activeTool === 'scissors'}
        selectionMode={SelectionMode.Partial}
        edgesReconnectable
        deleteKeyCode={['Backspace', 'Delete']}
        connectionRadius={30}
        selectNodesOnDrag={activeTool === 'select'}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-dots)"
        />
        <ZoomControls />
      </ReactFlow>
    </div>
  );
}
