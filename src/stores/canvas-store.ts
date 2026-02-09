import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { AppNode, AppEdge, ImageGeneratorNodeData, VideoGeneratorNodeData, TextNodeData, MediaNodeData, StickyNoteNodeData, StickerNodeData, GroupNodeData, StoryboardNodeData,ProductShotNodeData, MusicGeneratorNodeData, SpeechNodeData, VideoAudioNodeData, PluginNodeData } from '@/lib/types';

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

  // Selection state
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // History state (undo/redo)
  history: HistorySnapshot[];
  historyIndex: number;

  // Clipboard state (not persisted)
  clipboard: ClipboardData | null;

  // Settings panel state (Image Generator)
  settingsPanelNodeId: string | null;
  settingsPanelPosition: { x: number; y: number } | null;

  // Video settings panel state
  videoSettingsPanelNodeId: string | null;
  videoSettingsPanelPosition: { x: number; y: number } | null;

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
  groupSelected: () => void;

  // History actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Workflow actions
  runAll: () => Promise<void>;
  isRunningAll: boolean;

  // Settings panel actions (Image Generator)
  openSettingsPanel: (nodeId: string, position: { x: number; y: number }) => void;
  closeSettingsPanel: () => void;

  // Video settings panel actions
  openVideoSettingsPanel: (nodeId: string, position: { x: number; y: number }) => void;
  closeVideoSettingsPanel: () => void;

  // Context menu actions
  showContextMenu: (x: number, y: number, type: 'node' | 'canvas') => void;
  hideContextMenu: () => void;

  // Keyboard shortcuts panel
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;

  // Active tool
  activeTool: 'select' | 'pan' | 'scissors';
  setActiveTool: (tool: 'select' | 'pan' | 'scissors') => void;

  // React Flow instance (for viewport calculations)
  reactFlowInstance: ReactFlowInstance<AppNode, AppEdge> | null;
  setReactFlowInstance: (instance: ReactFlowInstance<AppNode, AppEdge>) => void;
  getViewportCenter: () => { x: number; y: number };

  // Utility
  getNode: (nodeId: string) => AppNode | undefined;
  getConnectedInputs: (nodeId: string) => {
    textContent?: string;
    referenceUrl?: string;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
    referenceUrls?: string[];
    productImageUrl?: string;
    characterImageUrl?: string;
    videoUrl?: string;
  };
  clearCanvas: () => void;

  // Canvas loading (for multi-canvas support)
  loadCanvasData: (nodes: AppNode[], edges: AppEdge[]) => void;

  // Read-only mode (for showcase templates)
  isReadOnly: boolean;
  setReadOnly: (readOnly: boolean) => void;
  loadAsReadOnly: (nodes: AppNode[], edges: AppEdge[]) => void;
  duplicateToEditable: () => void;
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
    duration: 8, // Veo-3 supports 4, 6, 8 - use 8 as default
    resolution: '720p',
    generateAudio: true,
    isGenerating: false,
    name,
  } as VideoGeneratorNodeData,
});

export const createStickyNoteNode = (position: { x: number; y: number }): AppNode => ({
  id: generateId(),
  type: 'stickyNote',
  position,
  data: {
    content: '',
    color: 'yellow',
  } as StickyNoteNodeData,
});

export const createStickerNode = (position: { x: number; y: number }): AppNode => ({
  id: generateId(),
  type: 'sticker',
  position,
  data: {
    emoji: '👍',
    size: 'md',
  } as StickerNodeData,
});

export const createGroupNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'group',
  position,
  zIndex: -1, // Render behind other nodes
  data: {
    name: name || 'Group',
    color: '#6366f1',
    width: 300,
    height: 200,
  } as GroupNodeData,
});

export const createStoryboardNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'storyboard',
  position,
  data: {
    name: name || 'Storyboard',
    product: '',
    character: '',
    concept: '',
    sceneCount: 4,
    style: 'cinematic',
    mode: 'transition',
    viewState: 'form',
    chatMessages: [],
    thinkingBlocks: [],
    drafts: [],
    chatPhase: 'idle',
  } as StoryboardNodeData,
});

export const createProductShotNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'productShot',
  position,
  data: {
    name: name || 'Product Shots',
    productName: '',
    shotCount: 4,
    background: 'studio-white',
    lighting: 'soft',
    viewState: 'form',
  } as ProductShotNodeData,
});

export const createMusicGeneratorNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'musicGenerator',
  position,
  data: {
    name: name || 'Music Generator',
    prompt: '',
    duration: 30,
    instrumental: false,
    guidanceScale: 7,
    isGenerating: false,
  } as MusicGeneratorNodeData,
});

export const createSpeechNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'speech',
  position,
  data: {
    name: name || 'Speech',
    text: '',
    voice: 'rachel',
    speed: 1.0,
    stability: 0.5,
    isGenerating: false,
  } as SpeechNodeData,
});

export const createVideoAudioNode = (position: { x: number; y: number }, name?: string): AppNode => ({
  id: generateId(),
  type: 'videoAudio',
  position,
  data: {
    name: name || 'Video Audio',
    prompt: '',
    duration: 10,
    cfgStrength: 4.5,
    isGenerating: false,
  } as VideoAudioNodeData,
});

/**
 * Create a plugin node with initial state
 * Used for plugin-defined nodes like Animation Generator
 */
export const createPluginNode = (
  position: { x: number; y: number },
  pluginId: string,
  name?: string,
  initialState?: Record<string, unknown>
): AppNode => ({
  id: generateId(),
  type: 'pluginNode',
  position,
  data: {
    pluginId,
    name,
    state: initialState || {},
  } as PluginNodeData,
});

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    history: [],
    historyIndex: -1,
    clipboard: null,
    settingsPanelNodeId: null,
    settingsPanelPosition: null,
    videoSettingsPanelNodeId: null,
    videoSettingsPanelPosition: null,
    contextMenu: null,
    isRunningAll: false,
    showShortcuts: false,
    activeTool: 'select' as const,
    reactFlowInstance: null,
    isReadOnly: false,

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
        const { _pushHistory, nodes } = get() as CanvasState & { _pushHistory: () => void };
        const hasPositionChange = changes.some(
          (c) => c.type === 'position' && c.dragging === false
        );

        // Check if any group nodes are being dragged
        const groupPositionChanges = changes.filter(
          (c) => c.type === 'position' && c.position
        );

        // Track group movements to move child nodes
        const groupDeltas: { groupId: string; deltaX: number; deltaY: number; group: AppNode }[] = [];

        for (const change of groupPositionChanges) {
          if (change.type === 'position' && change.position) {
            const node = nodes.find((n) => n.id === change.id);
            if (node?.type === 'group') {
              const deltaX = change.position.x - node.position.x;
              const deltaY = change.position.y - node.position.y;
              // Only track if there's actual movement
              if (deltaX !== 0 || deltaY !== 0) {
                groupDeltas.push({ groupId: change.id, deltaX, deltaY, group: node });
              }
            }
          }
        }

        // Helper to check if a node is inside a group's bounds
        const isNodeInsideGroup = (node: AppNode, group: AppNode): boolean => {
          if (node.type === 'group' || node.id === group.id) return false;
          const groupData = group.data as GroupNodeData;
          const groupWidth = groupData.width || 300;
          const groupHeight = groupData.height || 200;

          // Check if node's center is inside the group
          const nodeCenterX = node.position.x + (node.measured?.width || 100) / 2;
          const nodeCenterY = node.position.y + (node.measured?.height || 50) / 2;

          return (
            nodeCenterX >= group.position.x &&
            nodeCenterX <= group.position.x + groupWidth &&
            nodeCenterY >= group.position.y &&
            nodeCenterY <= group.position.y + groupHeight
          );
        };

        // Apply original changes
        let updatedNodes = applyNodeChanges(changes, nodes) as AppNode[];

        // Move child nodes that are inside any moving group
        if (groupDeltas.length > 0) {
          const movedNodeIds = new Set(changes.filter((c) => c.type === 'position').map((c) => c.id));

          updatedNodes = updatedNodes.map((node) => {
            // Skip if this node is already being moved by the user
            if (movedNodeIds.has(node.id)) return node;

            // Check each moving group
            for (const { groupId, deltaX, deltaY, group } of groupDeltas) {
              // Check if node was inside the group BEFORE it moved
              if (isNodeInsideGroup(node, group)) {
                return {
                  ...node,
                  position: {
                    x: node.position.x + deltaX,
                    y: node.position.y + deltaY,
                  },
                };
              }
            }
            return node;
          });
        }

        set({ nodes: updatedNodes });

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

      groupSelected: () => {
        const { nodes, selectedNodeIds, _pushHistory } = get() as CanvasState & { _pushHistory: () => void };

        // Need at least 2 non-group nodes selected
        const selectedNodes = nodes.filter(
          (n) => selectedNodeIds.includes(n.id) && n.type !== 'group'
        );
        if (selectedNodes.length < 2) return;

        // Calculate bounding box of selected nodes
        const padding = 40;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const node of selectedNodes) {
          const w = node.measured?.width || 280;
          const h = node.measured?.height || 150;
          minX = Math.min(minX, node.position.x);
          minY = Math.min(minY, node.position.y);
          maxX = Math.max(maxX, node.position.x + w);
          maxY = Math.max(maxY, node.position.y + h);
        }

        const groupNode = createGroupNode(
          { x: minX - padding, y: minY - padding },
          `Group ${nodes.filter((n) => n.type === 'group').length + 1}`
        );
        (groupNode.data as GroupNodeData).width = maxX - minX + padding * 2;
        (groupNode.data as GroupNodeData).height = maxY - minY + padding * 2;

        // Insert at beginning so it renders behind other nodes
        set((state) => ({
          nodes: [groupNode, ...state.nodes] as AppNode[],
        }));
        _pushHistory();
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

          // Collect all reference URLs (main reference + additional refs)
          const allReferenceUrls: string[] = [];
          if (connectedInputs.referenceUrl) {
            allReferenceUrls.push(connectedInputs.referenceUrl);
          }
          if (connectedInputs.referenceUrls) {
            allReferenceUrls.push(...connectedInputs.referenceUrls);
          }

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
                // Pass single referenceUrl for backwards compatibility
                referenceUrl: connectedInputs.referenceUrl,
                // Pass all references as array for multi-reference models (NanoBanana supports up to 14)
                referenceUrls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
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

      // Video settings panel actions
      openVideoSettingsPanel: (nodeId, position) => {
        set({ videoSettingsPanelNodeId: nodeId, videoSettingsPanelPosition: position });
      },

      closeVideoSettingsPanel: () => {
        set({ videoSettingsPanelNodeId: null, videoSettingsPanelPosition: null });
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

      // React Flow instance
      setReactFlowInstance: (instance) => {
        set({ reactFlowInstance: instance });
      },

      getViewportCenter: () => {
        const { reactFlowInstance } = get();
        if (!reactFlowInstance) {
          // Fallback if no instance available
          return { x: 200, y: 200 };
        }

        // Get the viewport dimensions from the React Flow wrapper
        const { x, y, zoom } = reactFlowInstance.getViewport();
        const domNode = document.querySelector('.react-flow');
        const rect = domNode?.getBoundingClientRect();

        if (!rect) {
          return { x: 200, y: 200 };
        }

        // Calculate the center of the viewport in flow coordinates
        const centerX = (-x + rect.width / 2) / zoom;
        const centerY = (-y + rect.height / 2) / zoom;

        // Add small random offset to prevent stacking
        return {
          x: centerX + (Math.random() - 0.5) * 100,
          y: centerY + (Math.random() - 0.5) * 100,
        };
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

        // Helper to get video URL from a node
        const getVideoUrl = (node: AppNode | null | undefined): string | undefined => {
          if (!node) return undefined;
          if (node.type === 'media') {
            const mediaData = node.data as MediaNodeData;
            return mediaData.type === 'video' ? mediaData.url : undefined;
          } else if (node.type === 'videoGenerator') {
            return (node.data as VideoGeneratorNodeData).outputUrl;
          } else if (node.type === 'videoAudio') {
            return (node.data as VideoAudioNodeData).outputUrl;
          } else if (node.type === 'pluginNode') {
            // Support animation plugin output
            const pluginData = node.data as PluginNodeData;
            if (pluginData.pluginId === 'animation-generator') {
              const state = pluginData.state as { preview?: { videoUrl?: string }; output?: { videoUrl?: string }; versions?: Array<{ videoUrl: string }> };
              // Priority: final output > current preview > latest version
              return state.output?.videoUrl || state.preview?.videoUrl || state.versions?.[state.versions.length - 1]?.videoUrl;
            }
          }
          return undefined;
        };

        // Find edges connected to specific handles
        const textEdge = incomingEdges.find((e) => e.targetHandle === 'text');
        const refEdge = incomingEdges.find((e) => e.targetHandle === 'reference');
        const firstFrameEdge = incomingEdges.find((e) => e.targetHandle === 'firstFrame');
        const lastFrameEdge = incomingEdges.find((e) => e.targetHandle === 'lastFrame');
        const productImageEdge = incomingEdges.find((e) => e.targetHandle === 'productImage');
        const characterImageEdge = incomingEdges.find((e) => e.targetHandle === 'characterImage');
        const videoEdge = incomingEdges.find((e) => e.targetHandle === 'video');

        // Multi-reference handles (ref2-ref8 for ImageGenerator, ref1-ref3 for VideoGenerator)
        const refEdges = ['ref1', 'ref2', 'ref3', 'ref4', 'ref5', 'ref6', 'ref7', 'ref8']
          .map((handle) => incomingEdges.find((e) => e.targetHandle === handle))
          .filter(Boolean);

        // Get source nodes
        const textNode = textEdge ? nodes.find((n) => n.id === textEdge.source) : null;
        const refNode = refEdge ? nodes.find((n) => n.id === refEdge.source) : null;
        const firstFrameNode = firstFrameEdge ? nodes.find((n) => n.id === firstFrameEdge.source) : null;
        const lastFrameNode = lastFrameEdge ? nodes.find((n) => n.id === lastFrameEdge.source) : null;
        const productImageNode = productImageEdge ? nodes.find((n) => n.id === productImageEdge.source) : null;
        const characterImageNode = characterImageEdge ? nodes.find((n) => n.id === characterImageEdge.source) : null;
        const videoNode = videoEdge ? nodes.find((n) => n.id === videoEdge.source) : null;

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
          productImageUrl: getImageUrl(productImageNode),
          characterImageUrl: getImageUrl(characterImageNode),
          videoUrl: getVideoUrl(videoNode),
        };
      },

      clearCanvas: () => {
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        set({ nodes: [], edges: [], selectedNodeIds: [] });
        _pushHistory();
      },

      // Canvas loading (for multi-canvas support)
      loadCanvasData: (nodes, edges) => {
        // Reset history and load new canvas data
        set({
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          history: [],
          historyIndex: -1,
          clipboard: null,
          settingsPanelNodeId: null,
          settingsPanelPosition: null,
          videoSettingsPanelNodeId: null,
          videoSettingsPanelPosition: null,
          contextMenu: null,
          isReadOnly: false,
        });

        // Initialize history with loaded state
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        _pushHistory();
      },

      // Read-only mode (for showcase templates)
      setReadOnly: (readOnly) => {
        set({ isReadOnly: readOnly });
      },

      loadAsReadOnly: (nodes, edges) => {
        // Load canvas in read-only mode (for showcase templates)
        set({
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          history: [],
          historyIndex: -1,
          clipboard: null,
          settingsPanelNodeId: null,
          settingsPanelPosition: null,
          videoSettingsPanelNodeId: null,
          videoSettingsPanelPosition: null,
          contextMenu: null,
          isReadOnly: true,
        });
      },

      duplicateToEditable: () => {
        // Clone current canvas and make it editable
        const { nodes, edges } = get();

        // Generate new IDs for all nodes
        const idMap = new Map<string, string>();
        const newNodes = nodes.map((node) => {
          const newId = generateId();
          idMap.set(node.id, newId);
          return {
            ...JSON.parse(JSON.stringify(node)),
            id: newId,
          };
        });

        // Update edge references
        const newEdges = edges.map((edge) => ({
          ...JSON.parse(JSON.stringify(edge)),
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        set({
          nodes: newNodes as AppNode[],
          edges: newEdges,
          isReadOnly: false,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          history: [],
          historyIndex: -1,
        });

        // Initialize history
        const { _pushHistory } = get() as CanvasState & { _pushHistory: () => void };
        _pushHistory();
      },
    }),
    {
      name: 'spaces-canvas-storage',
      storage: createJSONStorage(() => ({
        getItem: (name: string) => localStorage.getItem(name),
        setItem: (name: string, value: string) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            // QuotaExceededError — log but don't crash. State is still in memory.
            console.warn('[canvas-store] localStorage quota exceeded, state not persisted:', e);
          }
        },
        removeItem: (name: string) => localStorage.removeItem(name),
      })),
      // Only persist nodes and edges - not UI state like selections, clipboard, etc.
      // Animation nodes carry heavy runtime state (messages, tool calls, thinking blocks,
      // video versions) that can easily blow the ~5MB localStorage quota.
      // Strip it down to config-only data for persistence.
      partialize: (state) => ({
        nodes: state.nodes.map((node) => {
          // Strip data: URLs from MediaNode — they're cached in IndexedDB
          if (node.type === 'media' && node.data && typeof node.data === 'object') {
            const d = node.data as Record<string, unknown>;
            if (typeof d.url === 'string' && (d.url as string).startsWith('data:')) {
              return { ...node, data: { ...d, url: `cached:${node.id}` } };
            }
          }
          // Strip animation plugin heavy state
          if (node.type === 'pluginNode' && node.data && typeof node.data === 'object' && 'state' in node.data) {
            const d = node.data as Record<string, unknown>;
            const animState = d.state as Record<string, unknown> | undefined;
            return {
              ...node,
              data: {
                ...d,
                // Keep only essential state — drop conversation history, tool calls, etc.
                state: animState ? {
                  nodeId: animState.nodeId,
                  phase: animState.phase === 'executing' || animState.phase === 'preview' ? 'idle' : animState.phase,
                  messages: [],
                  toolCalls: [],
                  thinkingBlocks: [],
                  sandboxId: animState.sandboxId,
                  // Persist plan (small JSON, needed for context on snapshot restore)
                  plan: animState.plan,
                  // Persist versions with permanent URLs only (filter out sandbox-local URLs)
                  versions: Array.isArray(animState.versions)
                    ? (animState.versions as Array<Record<string, unknown>>).filter(
                        (v) => typeof v.videoUrl === 'string' && !(v.videoUrl as string).includes('/sandbox/')
                      )
                    : undefined,
                  createdAt: animState.createdAt,
                  updatedAt: animState.updatedAt,
                } : d.state,
                // Drop cached media data URLs (they're in IndexedDB via media-cache)
                media: Array.isArray(d.media)
                  ? (d.media as Array<Record<string, unknown>>).map((m) => ({
                      ...m,
                      dataUrl: typeof m.dataUrl === 'string' && (m.dataUrl as string).startsWith('data:')
                        ? `cached:${m.id}` // placeholder — real data is in IndexedDB
                        : m.dataUrl,
                    }))
                  : d.media,
                // Strip logo data URLs (persist URL logos only)
                logo: d.logo && typeof (d.logo as Record<string, unknown>).url === 'string'
                  && (((d.logo as Record<string, unknown>).url as string).startsWith('data:'))
                  ? undefined  // data URLs are too large for localStorage
                  : d.logo,
              },
            };
          }
          return node;
        }),
        edges: state.edges,
      }),
    }
  )
);
