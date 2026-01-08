import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import type { AppNode, AppEdge, ImageGeneratorNodeData, VideoGeneratorNodeData, TextNodeData, MediaNodeData } from '@/lib/types';

// History snapshot type
interface HistorySnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
}

// Clipboard type
interface ClipboardData {
  nodes: AppNode[];
  edges: AppEdge[];
}

interface CanvasState {
  // Canvas state
  nodes: AppNode[];
  edges: AppEdge[];
  spaceName: string;

  // Selection state
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // History state (undo/redo)
  history: HistorySnapshot[];
  historyIndex: number;

  // Clipboard state (not persisted)
  clipboard: ClipboardData | null;

  // Settings panel state
  settingsPanelNodeId: string | null;
  settingsPanelPosition: { x: number; y: number } | null;

  // Context menu state
  contextMenu: {
    x: number;
    y: number;
    type: 'node' | 'canvas';
  } | null;

  // Node actions
  addNode: (node: AppNode) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  deleteNode: (nodeId: string) => void;

  // React Flow handlers
  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Selection actions
  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelectedEdges: () => void;

  // Clipboard actions
  copySelected: () => void;
  cutSelected: () => void;
  paste: (position?: { x: number; y: number }) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;

  // History actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Space actions
  setSpaceName: (name: string) => void;

  // Workflow actions
  runAll: () => Promise<void>;
  isRunningAll: boolean;

  // Settings panel actions
  openSettingsPanel: (nodeId: string, position: { x: number; y: number }) => void;
  closeSettingsPanel: () => void;

  // Context menu actions
  showContextMenu: (x: number, y: number, type: 'node' | 'canvas') => void;
  hideContextMenu: () => void;

  // Keyboard shortcuts panel
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;

  // Active tool
  activeTool: 'select' | 'pan' | 'scissors';
  setActiveTool: (tool: 'select' | 'pan' | 'scissors') => void;

  // Utility
  getNode: (nodeId: string) => AppNode | undefined;
  getConnectedInputs: (nodeId: string) => {
    textContent?: string;
    referenceUrl?: string;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
    referenceUrls?: string[];
  };
  clearCanvas: () => void;
}

// Generate unique IDs
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Max history states
const MAX_HISTORY = 50;

// Helper to create a deep clone of nodes/edges
const cloneSnapshot = (nodes: AppNode[], edges: AppEdge[]): HistorySnapshot => ({
  nodes: JSON.parse(JSON.stringify(nodes)),
  edges: JSON.parse(JSON.stringify(edges)),
});

// Default node creators
export const createImageGeneratorNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'imageGenerator',
  position,
  data: {
    prompt: '',
    model: 'flux-schnell',
    aspectRatio: '1:1',
    isGenerating: false,
    name,
  } as ImageGeneratorNodeData,
});

export const createTextNode = (position: { x: number; y: number }): AppNode => ({
  id: generateId(),
  type: 'text',
  position,
  data: {
    content: '',
  } as TextNodeData,
});

export const createMediaNode = (position: { x: number; y: number }): AppNode => ({
  id: generateId(),
  type: 'media',
  position,
  data: {
    url: undefined,
    type: 'image',
  } as MediaNodeData,
});

export const createVideoGeneratorNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'videoGenerator',
  position,
  data: {
    prompt: '',
    model: 'veo-3',
    aspectRatio: '16:9',
    duration: 5,
    isGenerating: false,
    name,
  } as VideoGeneratorNodeData,
});

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      spaceName: 'Untitled Space',
      selectedNodeIds: [],
      selectedEdgeIds: [],
      history: [],
      historyIndex: -1,
      clipboard: null,
      settingsPanelNodeId: null,
      settingsPanelPosition: null,
      contextMenu: null,
      isRunningAll: false,
      showShortcuts: false,
      activeTool: 'select' as const,

      // Helper to push current state to history
      _pushHistory: () => {
        const { nodes, edges, history, historyIndex } = get();

        // Remove any forward history if we're not at the end
        const newHistory = history.slice(0, historyIndex + 1);

        // Add current state
        newHistory.push(cloneSnapshot(nodes, edges));

        // Limit history size
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift();
        }

        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      addNode: (node) => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        set((state) => ({
          nodes: [...state.nodes, node],
        }));
        _pushHistory();
      },

      updateNodeData: (nodeId, data) => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ) as AppNode[],
        }));
        _pushHistory();
      },

      deleteNode: (nodeId) => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== nodeId),
          edges: state.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
          selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
        }));
        _pushHistory();
      },

      onNodesChange: (changes) => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        const hasPositionChange = changes.some(
          (c) => c.type === 'position' && c.dragging === false
        );

        set((state) => ({
          nodes: applyNodeChanges(changes, state.nodes) as AppNode[],
        }));

        // Only push history when drag ends
        if (hasPositionChange) {
          _pushHistory();
        }
      },

      onEdgesChange: (changes) => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        const hasRemove = changes.some((c) => c.type === 'remove');

        set((state) => ({
          edges: applyEdgeChanges(changes, state.edges),
        }));

        if (hasRemove) {
          _pushHistory();
        }
      },

      onConnect: (connection) => {
        // Prevent self-connections
        if (connection.source === connection.target) {
          return;
        }
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        set((state) => ({
          edges: addEdge(connection, state.edges),
        }));
        _pushHistory();
      },

      // Selection actions
      setSelectedNodes: (ids) => {
        set({ selectedNodeIds: ids });
      },

      setSelectedEdges: (ids) => {
        set({ selectedEdgeIds: ids });
      },

      selectAll: () => {
        set((state) => ({
          selectedNodeIds: state.nodes.map((n) => n.id),
        }));
      },

      clearSelection: () => {
        set({ selectedNodeIds: [], selectedEdgeIds: [] });
      },

      deleteSelectedEdges: () => {
        const { selectedEdgeIds, _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        if (selectedEdgeIds.length === 0) return;

        set((state) => ({
          edges: state.edges.filter((e) => !selectedEdgeIds.includes(e.id)),
          selectedEdgeIds: [],
        }));
        _pushHistory();
      },

      // Clipboard actions
      copySelected: () => {
        const { nodes, edges, selectedNodeIds } = get();
        if (selectedNodeIds.length === 0) return;

        const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
        const relatedEdges = edges.filter(
          (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
        );

        set({
          clipboard: {
            nodes: JSON.parse(JSON.stringify(selectedNodes)),
            edges: JSON.parse(JSON.stringify(relatedEdges)),
          },
        });
      },

      cutSelected: () => {
        const { copySelected, deleteSelected } = get();
        copySelected();
        deleteSelected();
      },

      paste: (position) => {
        const { clipboard, nodes, _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        if (!clipboard || clipboard.nodes.length === 0) return;

        // Generate new IDs and calculate offset
        const idMap = new Map<string, string>();
        const offsetX = position ? position.x - clipboard.nodes[0].position.x : 50;
        const offsetY = position ? position.y - clipboard.nodes[0].position.y : 50;

        // Clone nodes with new IDs
        const newNodes = clipboard.nodes.map((node) => {
          const newId = generateId();
          idMap.set(node.id, newId);
          return {
            ...node,
            id: newId,
            position: {
              x: node.position.x + offsetX,
              y: node.position.y + offsetY,
            },
            selected: true,
          };
        });

        // Clone edges with remapped IDs
        const newEdges = clipboard.edges.map((edge) => ({
          ...edge,
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        set((state) => ({
          nodes: [...state.nodes, ...newNodes] as AppNode[],
          edges: [...state.edges, ...newEdges],
          selectedNodeIds: newNodes.map((n) => n.id),
        }));

        _pushHistory();
      },

      deleteSelected: () => {
        const { selectedNodeIds, _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        if (selectedNodeIds.length === 0) return;

        set((state) => ({
          nodes: state.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
          edges: state.edges.filter(
            (e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
          ),
          selectedNodeIds: [],
        }));

        _pushHistory();
      },

      duplicateSelected: () => {
        const { copySelected, paste, nodes, selectedNodeIds } = get();
        if (selectedNodeIds.length === 0) return;

        copySelected();

        // Calculate center of selected nodes for paste position
        const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
        const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
        const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

        paste({ x: avgX + 50, y: avgY + 50 });
      },

      // History actions
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;

        const newIndex = historyIndex - 1;
        const snapshot = history[newIndex];

        set({
          nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
          edges: JSON.parse(JSON.stringify(snapshot.edges)),
          historyIndex: newIndex,
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const newIndex = historyIndex + 1;
        const snapshot = history[newIndex];

        set({
          nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
          edges: JSON.parse(JSON.stringify(snapshot.edges)),
          historyIndex: newIndex,
        });
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // Space actions
      setSpaceName: (name) => {
        set({ spaceName: name });
      },

      // Workflow actions
      runAll: async () => {
        const { nodes, updateNodeData, getConnectedInputs } = get() as CanvasState & { _pushHistory: () => void };

        // Get all ImageGenerator nodes that have a prompt (direct or connected)
        const generators = nodes.filter((n) => n.type === 'imageGenerator');

        if (generators.length === 0) return;

        set({ isRunningAll: true });

        // Execute sequentially to avoid rate limiting
        for (const gen of generators) {
          const data = gen.data as ImageGeneratorNodeData;
          const connectedInputs = getConnectedInputs(gen.id);

          // Build final prompt with preset modifiers
          const promptParts: string[] = [];

          // Add character modifier
          if (data.selectedCharacter?.type === 'preset') {
            promptParts.push(data.selectedCharacter.promptModifier);
          }

          // Add style preset modifier
          if (data.selectedStyle) {
            promptParts.push(data.selectedStyle.promptModifier);
          }

          // Add camera angle modifier
          if (data.selectedCameraAngle) {
            promptParts.push(data.selectedCameraAngle.promptModifier);
          }

          // Add camera lens modifier
          if (data.selectedCameraLens) {
            promptParts.push(data.selectedCameraLens.promptModifier);
          }

          // Add connected text content
          if (connectedInputs.textContent) {
            promptParts.push(connectedInputs.textContent);
          }

          // Add user prompt
          if (data.prompt) {
            promptParts.push(data.prompt);
          }

          const finalPrompt = promptParts.join(', ');

          // Check if we have any input (presets count as valid input)
          const hasPresets = !!(
            data.selectedCharacter ||
            data.selectedStyle ||
            data.selectedCameraAngle ||
            data.selectedCameraLens
          );

          // Skip if no prompt and no presets
          if (!finalPrompt && !hasPresets) continue;

          updateNodeData(gen.id, { isGenerating: true, error: undefined });

          try {
            const response = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: finalPrompt,
                model: data.model,
                aspectRatio: data.aspectRatio,
                imageSize: data.imageSize || 'square_hd',
                resolution: data.resolution || '1K',
                imageCount: data.imageCount || 1,
                referenceUrl: connectedInputs.referenceUrl,
                // Model-specific params
                style: data.style,
                magicPrompt: data.magicPrompt,
                cfgScale: data.cfgScale,
                steps: data.steps,
                strength: data.strength,
              }),
            });

            if (!response.ok) {
              throw new Error('Generation failed');
            }

            const result = await response.json();
            const imageUrls: string[] = result.imageUrls || [result.imageUrl];

            updateNodeData(gen.id, {
              outputUrl: imageUrls[0],
              outputUrls: imageUrls,
              isGenerating: false,
            });
          } catch (error) {
            updateNodeData(gen.id, {
              error: error instanceof Error ? error.message : 'Generation failed',
              isGenerating: false,
            });
          }
        }

        set({ isRunningAll: false });
      },

      // Settings panel actions
      openSettingsPanel: (nodeId, position) => {
        set({ settingsPanelNodeId: nodeId, settingsPanelPosition: position });
      },

      closeSettingsPanel: () => {
        set({ settingsPanelNodeId: null, settingsPanelPosition: null });
      },

      // Context menu actions
      showContextMenu: (x, y, type) => {
        set({ contextMenu: { x, y, type } });
      },

      hideContextMenu: () => {
        set({ contextMenu: null });
      },

      // Keyboard shortcuts panel
      setShowShortcuts: (show) => {
        set({ showShortcuts: show });
      },

      // Active tool
      setActiveTool: (tool) => {
        set({ activeTool: tool, selectedEdgeIds: [] });
      },

      // Utility
      getNode: (nodeId) => {
        return get().nodes.find((node) => node.id === nodeId);
      },

      getConnectedInputs: (nodeId) => {
        const { nodes, edges } = get();
        const incomingEdges = edges.filter((e) => e.target === nodeId);

        // Helper to get image URL from a node
        const getImageUrl = (node: AppNode | null | undefined): string | undefined => {
          if (!node) return undefined;
          if (node.type === 'media') {
            return (node.data as MediaNodeData).url;
          } else if (node.type === 'imageGenerator') {
            return (node.data as ImageGeneratorNodeData).outputUrl;
          }
          return undefined;
        };

        // Find edges connected to specific handles
        const textEdge = incomingEdges.find((e) => e.targetHandle === 'text');
        const refEdge = incomingEdges.find((e) => e.targetHandle === 'reference');
        const firstFrameEdge = incomingEdges.find((e) => e.targetHandle === 'firstFrame');
        const lastFrameEdge = incomingEdges.find((e) => e.targetHandle === 'lastFrame');

        // Multi-reference handles (ref2-ref8 for ImageGenerator, ref1-ref3 for VideoGenerator)
        const refEdges = ['ref1', 'ref2', 'ref3', 'ref4', 'ref5', 'ref6', 'ref7', 'ref8']
          .map((handle) => incomingEdges.find((e) => e.targetHandle === handle))
          .filter(Boolean);

        // Get source nodes
        const textNode = textEdge ? nodes.find((n) => n.id === textEdge.source) : null;
        const refNode = refEdge ? nodes.find((n) => n.id === refEdge.source) : null;
        const firstFrameNode = firstFrameEdge ? nodes.find((n) => n.id === firstFrameEdge.source) : null;
        const lastFrameNode = lastFrameEdge ? nodes.find((n) => n.id === lastFrameEdge.source) : null;

        // Get multi-reference URLs
        const referenceUrls = refEdges
          .map((edge) => {
            const node = edge ? nodes.find((n) => n.id === edge.source) : null;
            return getImageUrl(node);
          })
          .filter((url): url is string => !!url);

        return {
          textContent: (textNode?.data as TextNodeData | undefined)?.content,
          referenceUrl: getImageUrl(refNode),
          firstFrameUrl: getImageUrl(firstFrameNode),
          lastFrameUrl: getImageUrl(lastFrameNode),
          referenceUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
        };
      },

      clearCanvas: () => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        set({ nodes: [], edges: [], selectedNodeIds: [] });
        _pushHistory();
      },
    }),
    {
      name: 'spaces-canvas-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        spaceName: state.spaceName,
        // Don't persist: history, historyIndex, clipboard, selectedNodeIds
      }),
    }
  )
);
