/**
 * Canvas API Implementation
 *
 * Provides a safe interface for plugins to interact with the canvas.
 * This hook wraps the canvas store and React Flow instance.
 */

import { useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  useCanvasStore,
  createImageGeneratorNode,
  createTextNode,
  createMediaNode,
  createVideoGeneratorNode,
} from '@/stores/canvas-store';
import type { CanvasAPI, CreateNodeInput, CreateNodeType } from './types';
import type { AppNode, ImageGeneratorNodeData, VideoGeneratorNodeData, TextNodeData, MediaNodeData } from '@/lib/types';

// Default layout constants
const DEFAULT_COLUMNS = 3;
const DEFAULT_SPACING = 320;
const NODE_WIDTH = 280;
const NODE_HEIGHT = 200;

/**
 * Hook to create a Canvas API instance for plugins
 *
 * Must be used within a ReactFlowProvider context.
 *
 * @returns CanvasAPI instance
 */
export function useCanvasAPI(): CanvasAPI {
  const reactFlow = useReactFlow();

  // Get store state and actions
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const addNode = useCanvasStore((state) => state.addNode);
  const onConnect = useCanvasStore((state) => state.onConnect);

  // Read operations
  const getNodes = useCallback(() => {
    return nodes;
  }, [nodes]);

  const getSelectedNodes = useCallback(() => {
    return nodes.filter((node) => selectedNodeIds.includes(node.id));
  }, [nodes, selectedNodeIds]);

  const getEdges = useCallback(() => {
    return edges;
  }, [edges]);

  // Create a node based on type
  const createNodeByType = useCallback(
    (input: CreateNodeInput): AppNode => {
      const position = input.position ?? { x: 0, y: 0 };

      switch (input.type) {
        case 'text': {
          const node = createTextNode(position);
          if (input.data.content !== undefined) {
            (node.data as TextNodeData).content = input.data.content as string;
          }
          return node;
        }

        case 'media': {
          const node = createMediaNode(position);
          const data = node.data as MediaNodeData;
          if (input.data.url !== undefined) {
            data.url = input.data.url as string;
          }
          if (input.data.type !== undefined) {
            data.type = input.data.type as 'image' | 'video';
          }
          return node;
        }

        case 'imageGenerator': {
          const node = createImageGeneratorNode(position, input.name);
          const data = node.data as ImageGeneratorNodeData;
          // Copy any provided data
          Object.assign(data, input.data);
          return node;
        }

        case 'videoGenerator': {
          const node = createVideoGeneratorNode(position, input.name);
          const data = node.data as VideoGeneratorNodeData;
          // Copy any provided data
          Object.assign(data, input.data);
          return node;
        }

        default:
          throw new Error(`Unknown node type: ${input.type}`);
      }
    },
    []
  );

  // Create a single node
  const createNode = useCallback(
    async (input: CreateNodeInput): Promise<string> => {
      const node = createNodeByType(input);
      addNode(node);
      return node.id;
    },
    [createNodeByType, addNode]
  );

  // Create multiple nodes
  const createNodes = useCallback(
    async (inputs: CreateNodeInput[]): Promise<string[]> => {
      const ids: string[] = [];
      for (const input of inputs) {
        const node = createNodeByType(input);
        addNode(node);
        ids.push(node.id);
      }
      return ids;
    },
    [createNodeByType, addNode]
  );

  // Create an edge between nodes
  const createEdge = useCallback(
    async (
      fromId: string,
      fromHandle: string,
      toId: string,
      toHandle: string
    ): Promise<string> => {
      const connection = {
        source: fromId,
        sourceHandle: fromHandle,
        target: toId,
        targetHandle: toHandle,
      };
      onConnect(connection);
      // Generate edge ID (matches the pattern in canvas store)
      return `edge_${fromId}_${toId}`;
    },
    [onConnect]
  );

  // Get viewport center position
  const getViewportCenter = useCallback((): { x: number; y: number } => {
    const viewport = reactFlow.getViewport();
    const { width, height } = reactFlow.getNodes().length > 0
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 800, height: 600 };

    // Calculate center in flow coordinates
    const centerX = (-viewport.x + width / 2) / viewport.zoom;
    const centerY = (-viewport.y + height / 2) / viewport.zoom;

    return { x: centerX, y: centerY };
  }, [reactFlow]);

  // Calculate grid position for index
  const getGridPosition = useCallback(
    (
      index: number,
      columns: number = DEFAULT_COLUMNS,
      spacing: number = DEFAULT_SPACING,
      startPosition?: { x: number; y: number }
    ): { x: number; y: number } => {
      const start = startPosition ?? getViewportCenter();
      const col = index % columns;
      const row = Math.floor(index / columns);

      // Center the grid around the start position
      const gridWidth = (columns - 1) * spacing;
      const offsetX = -gridWidth / 2;

      return {
        x: start.x + offsetX + col * spacing,
        y: start.y + row * spacing,
      };
    },
    [getViewportCenter]
  );

  // Focus on a specific node
  const focusNode = useCallback(
    (nodeId: string): void => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        reactFlow.setCenter(
          node.position.x + NODE_WIDTH / 2,
          node.position.y + NODE_HEIGHT / 2,
          { zoom: 1, duration: 500 }
        );
      }
    },
    [nodes, reactFlow]
  );

  // Fit view to show nodes
  const fitView = useCallback(
    (nodeIds?: string[]): void => {
      if (nodeIds && nodeIds.length > 0) {
        reactFlow.fitView({
          nodes: nodeIds.map((id) => ({ id })),
          padding: 0.2,
          duration: 500,
        });
      } else {
        reactFlow.fitView({ padding: 0.2, duration: 500 });
      }
    },
    [reactFlow]
  );

  // Memoize the API object
  const api = useMemo<CanvasAPI>(
    () => ({
      getNodes,
      getSelectedNodes,
      getEdges,
      createNode,
      createNodes,
      createEdge,
      getViewportCenter,
      getGridPosition,
      focusNode,
      fitView,
    }),
    [
      getNodes,
      getSelectedNodes,
      getEdges,
      createNode,
      createNodes,
      createEdge,
      getViewportCenter,
      getGridPosition,
      focusNode,
      fitView,
    ]
  );

  return api;
}
