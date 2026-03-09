import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import type {
  AppEdge,
  AppNode,
  ConnectedNodeInputs,
  GroupNodeData,
  ImageGeneratorNodeData,
  MediaNodeData,
  MusicGeneratorNodeData,
  PluginNodeData,
  ProductShotNodeData,
  SpeechNodeData,
  StickerNodeData,
  StickyNoteNodeData,
  StoryboardNodeData,
  TextNodeData,
  VideoAudioNodeData,
  VideoGeneratorNodeData,
} from '@/lib/types';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import { startImageCompare } from '@/lib/compare/controller';
import { buildImageGenerationRequest, buildImagePrompt, hasValidImagePromptInput } from '@/lib/generation/client';
import { useSettingsStore } from './settings-store';
import { remapChildNodeIds, resolveInheritedGroupDelta } from './grouping-utils';
import {
  createCanvasMutationRecord,
  deepCloneCanvasValue,
  normalizeAppNode,
  normalizeAppNodes,
  type CanvasDetailLevel,
  type CanvasMutationOptions,
  type CanvasMutationRecord,
} from './canvas-store-helpers';

interface HistorySnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
}

interface ClipboardData {
  nodes: AppNode[];
  edges: AppEdge[];
}

interface CanvasState {
  nodes: AppNode[];
  edges: AppEdge[];
  canvasDetailLevel: CanvasDetailLevel;
  lastMutation: CanvasMutationRecord | null;

  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  history: HistorySnapshot[];
  historyIndex: number;
  clipboard: ClipboardData | null;

  settingsPanelNodeId: string | null;
  settingsPanelPosition: { x: number; y: number } | null;
  videoSettingsPanelNodeId: string | null;
  videoSettingsPanelPosition: { x: number; y: number } | null;
  contextMenu: {
    x: number;
    y: number;
    type: 'node' | 'canvas';
  } | null;

  addNode: (node: AppNode) => void;
  addNodes: (nodes: AppNode[]) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, options?: CanvasMutationOptions | boolean) => void;
  deleteNode: (nodeId: string) => void;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelectedEdges: () => void;

  copySelected: () => void;
  cutSelected: () => void;
  paste: (position?: { x: number; y: number }) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  groupSelected: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  runAll: () => Promise<void>;
  isRunningAll: boolean;

  openSettingsPanel: (nodeId: string, position: { x: number; y: number }) => void;
  closeSettingsPanel: () => void;
  openVideoSettingsPanel: (nodeId: string, position: { x: number; y: number }) => void;
  closeVideoSettingsPanel: () => void;

  showContextMenu: (x: number, y: number, type: 'node' | 'canvas') => void;
  hideContextMenu: () => void;

  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;

  activeTool: 'select' | 'pan' | 'scissors';
  setActiveTool: (tool: 'select' | 'pan' | 'scissors') => void;

  reactFlowInstance: ReactFlowInstance<AppNode, AppEdge> | null;
  setReactFlowInstance: (instance: ReactFlowInstance<AppNode, AppEdge>) => void;
  setCanvasDetailLevel: (level: CanvasDetailLevel) => void;
  spawnOffsetIndex: number;
  getViewportCenter: () => { x: number; y: number };

  getNode: (nodeId: string) => AppNode | undefined;
  getConnectedInputs: (nodeId: string) => ConnectedNodeInputs;
  clearCanvas: () => void;
  loadCanvasData: (nodes: AppNode[], edges: AppEdge[]) => void;

  isReadOnly: boolean;
  setReadOnly: (readOnly: boolean) => void;
  loadAsReadOnly: (nodes: AppNode[], edges: AppEdge[]) => void;
  duplicateToEditable: () => void;

  _pushHistory: () => void;
  _recordMutation: (options?: CanvasMutationOptions | boolean) => void;
}

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const MAX_HISTORY = 50;

const cloneSnapshot = (nodes: AppNode[], edges: AppEdge[]): HistorySnapshot => ({
  nodes: deepCloneCanvasValue(nodes),
  edges: deepCloneCanvasValue(edges),
});

function createNode<T extends AppNode>(node: T): T {
  return normalizeAppNode(node);
}

/**
 * Clear transient runtime state when duplicating nodes.
 * Prevents cloned nodes from inheriting in-flight generation UI state.
 */
export const resetTransientNodeStateForDuplicate = (node: AppNode): AppNode => {
  if (node.type !== 'imageGenerator') return node;

  const data = node.data as ImageGeneratorNodeData;
  return {
    ...node,
    data: {
      ...data,
      isGenerating: false,
      error: undefined,
    },
  };
};

function cloneNodes(nodes: AppNode[]): AppNode[] {
  return normalizeAppNodes(deepCloneCanvasValue(nodes));
}

function cloneEdges(edges: AppEdge[]): AppEdge[] {
  return deepCloneCanvasValue(edges);
}

export const createImageGeneratorNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
    id: generateId(),
    type: 'imageGenerator',
    position,
    data: {
      prompt: '',
      model: 'auto',
      aspectRatio: 'auto',
      isGenerating: false,
      name,
    } as ImageGeneratorNodeData,
  } as AppNode);

export const createTextNode = (position: { x: number; y: number }): AppNode =>
  createNode({
    id: generateId(),
    type: 'text',
    position,
    data: {
      content: '',
    } as TextNodeData,
  } as AppNode);

export const createMediaNode = (position: { x: number; y: number }): AppNode =>
  createNode({
    id: generateId(),
    type: 'media',
    position,
    data: {
      url: undefined,
      type: 'image',
    } as MediaNodeData,
  } as AppNode);

export const createVideoGeneratorNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
    id: generateId(),
    type: 'videoGenerator',
    position,
    data: {
      prompt: '',
      model: 'veo-3.1-fast-i2v',
      aspectRatio: '16:9',
      duration: 8,
      resolution: '720p',
      generateAudio: true,
      isGenerating: false,
      name,
    } as VideoGeneratorNodeData,
  } as AppNode);

export const createStickyNoteNode = (position: { x: number; y: number }): AppNode =>
  createNode({
    id: generateId(),
    type: 'stickyNote',
    position,
    data: {
      content: '',
      color: 'yellow',
    } as StickyNoteNodeData,
  } as AppNode);

export const createStickerNode = (position: { x: number; y: number }): AppNode =>
  createNode({
    id: generateId(),
    type: 'sticker',
    position,
    data: {
      emoji: '👍',
      size: 'md',
    } as StickerNodeData,
  } as AppNode);

export const createGroupNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
    id: generateId(),
    type: 'group',
    position,
    zIndex: -1,
    data: {
      name: name || 'Group',
      color: '#6366f1',
      width: 300,
      height: 200,
    } as GroupNodeData,
  } as AppNode);

export const createStoryboardNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
    id: generateId(),
    type: 'storyboard',
    position,
    data: {
      name: name || 'Storyboard',
      references: [{ id: `ref_${Date.now()}`, role: 'subject', label: '', description: '', handleId: 'refImage_0' }],
      concept: '',
      sceneCount: 4,
      style: 'cinematic',
      mode: 'transition',
      targetVideoModel: 'veo',
      viewState: 'form',
      chatMessages: [],
      thinkingBlocks: [],
      drafts: [],
      chatPhase: 'idle',
    } as StoryboardNodeData,
  } as AppNode);

export const createProductShotNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
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
  } as AppNode);

export const createMusicGeneratorNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
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
  } as AppNode);

export const createSpeechNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
    id: generateId(),
    type: 'speech',
    position,
    data: {
      name: name || 'Speech',
      mode: 'single',
      text: '',
      voice: 'rachel',
      speed: 1,
      stability: 0.5,
      dialogueLines: [
        { id: generateId(), voice: 'rachel', text: '' },
        { id: generateId(), voice: 'drew', text: '' },
      ],
      isGenerating: false,
    } as SpeechNodeData,
  } as AppNode);

export const createVideoAudioNode = (position: { x: number; y: number }, name?: string): AppNode =>
  createNode({
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
  } as AppNode);

export const createPluginNode = (
  position: { x: number; y: number },
  pluginId: string,
  name?: string,
  initialState?: Record<string, unknown>
): AppNode =>
  createNode({
    id: generateId(),
    type: 'pluginNode',
    position,
    data: {
      pluginId,
      name,
      state: initialState || {},
    } as PluginNodeData,
  } as AppNode);

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  nodes: [],
  edges: [],
  canvasDetailLevel: 'full',
  lastMutation: null,
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
  activeTool: 'select',
  reactFlowInstance: null,
  spawnOffsetIndex: 0,
  isReadOnly: false,

  _pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cloneSnapshot(nodes, edges));

    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  _recordMutation: (options) => {
    set({ lastMutation: createCanvasMutationRecord(options) });
  },

  addNode: (node) => {
    const { _pushHistory, _recordMutation } = get();
    set((state) => ({
      nodes: [...state.nodes, createNode(node)],
    }));
    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  addNodes: (nodes) => {
    if (nodes.length === 0) return;
    const { _pushHistory, _recordMutation } = get();
    set((state) => ({
      nodes: [...state.nodes, ...normalizeAppNodes(nodes)],
    }));
    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  updateNodeData: (nodeId, data, options) => {
    const mutation = createCanvasMutationRecord(options);

    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? createNode({ ...node, data: { ...node.data, ...data } } as AppNode)
          : node
      ) as AppNode[],
      lastMutation: mutation,
    }));

    if (mutation.history === 'push') {
      get()._pushHistory();
    }
  },

  deleteNode: (nodeId) => {
    const { _pushHistory, _recordMutation } = get();
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
    }));
    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  onNodesChange: (changes) => {
    const { nodes, _pushHistory, _recordMutation } = get();
    const hasPositionCommit = changes.some((change) => change.type === 'position' && change.dragging === false);
    const hasRemove = changes.some((change) => change.type === 'remove');

    const groupPositionChanges = changes.filter(
      (change) => change.type === 'position' && change.position && typeof change.dragging === 'boolean'
    );
    const groupDeltas: { groupId: string; deltaX: number; deltaY: number; group: AppNode }[] = [];

    for (const change of groupPositionChanges) {
      if (change.type !== 'position' || !change.position) continue;
      const node = nodes.find((candidate) => candidate.id === change.id);
      if (node?.type !== 'group') continue;

      const deltaX = change.position.x - node.position.x;
      const deltaY = change.position.y - node.position.y;
      if (deltaX !== 0 || deltaY !== 0) {
        groupDeltas.push({ groupId: change.id, deltaX, deltaY, group: node });
      }
    }

    const isNodeInsideGroup = (node: AppNode, group: AppNode): boolean => {
      if (node.type === 'group' || node.id === group.id) return false;
      const groupData = group.data as GroupNodeData;
      const groupWidth = groupData.width || 300;
      const groupHeight = groupData.height || 200;
      const nodeCenterX = node.position.x + (node.measured?.width || 100) / 2;
      const nodeCenterY = node.position.y + (node.measured?.height || 50) / 2;

      return (
        nodeCenterX >= group.position.x &&
        nodeCenterX <= group.position.x + groupWidth &&
        nodeCenterY >= group.position.y &&
        nodeCenterY <= group.position.y + groupHeight
      );
    };

    let updatedNodes = normalizeAppNodes(applyNodeChanges(changes, nodes) as AppNode[]);

    if (groupDeltas.length > 0) {
      const movedNodeIds = new Set(changes.filter((change) => change.type === 'position').map((change) => change.id));
      const explicitOwner = new Map<string, string>();

      for (const group of nodes) {
        if (group.type !== 'group') continue;
        const childIds = (group.data as GroupNodeData).childNodeIds;
        if (!childIds) continue;
        for (const childId of childIds) explicitOwner.set(childId, group.id);
      }

      const groupDeltaById = new Map(groupDeltas.map((delta) => [delta.groupId, { x: delta.deltaX, y: delta.deltaY }]));
      const inheritedDeltaCache = new Map<string, { x: number; y: number } | null>();

      updatedNodes = updatedNodes.map((node) => {
        if (movedNodeIds.has(node.id)) return node;

        const inheritedDelta = resolveInheritedGroupDelta(
          node.id,
          explicitOwner,
          groupDeltaById,
          inheritedDeltaCache
        );
        if (inheritedDelta) {
          return createNode({
            ...node,
            position: {
              x: node.position.x + inheritedDelta.x,
              y: node.position.y + inheritedDelta.y,
            },
          } as AppNode);
        }

        if (explicitOwner.has(node.id)) return node;

        for (const { deltaX, deltaY, group } of groupDeltas) {
          if ((group.data as GroupNodeData).childNodeIds) continue;
          if (!isNodeInsideGroup(node, group)) continue;

          return createNode({
            ...node,
            position: {
              x: node.position.x + deltaX,
              y: node.position.y + deltaY,
            },
          } as AppNode);
        }

        return node;
      });
    }

    set({ nodes: updatedNodes });

    if (hasRemove) {
      _pushHistory();
      _recordMutation({ history: 'skip', kind: 'graph' });
      return;
    }

    if (hasPositionCommit) {
      _pushHistory();
      _recordMutation({ history: 'skip', kind: 'layout' });
    }
  },

  onEdgesChange: (changes) => {
    const { _pushHistory, _recordMutation } = get();
    const hasRemove = changes.some((change) => change.type === 'remove');

    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));

    if (!hasRemove) return;

    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  onConnect: (connection) => {
    if (connection.source === connection.target) {
      return;
    }

    const { _pushHistory, _recordMutation } = get();

    set((state) => ({
      edges: addEdge(connection, state.edges),
    }));

    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  setSelectedNodes: (ids) => {
    set({ selectedNodeIds: ids });
  },

  setSelectedEdges: (ids) => {
    set({ selectedEdgeIds: ids });
  },

  selectAll: () => {
    set((state) => ({
      selectedNodeIds: state.nodes.map((node) => node.id),
    }));
  },

  clearSelection: () => {
    set({ selectedNodeIds: [], selectedEdgeIds: [] });
  },

  deleteSelectedEdges: () => {
    const { selectedEdgeIds, _pushHistory, _recordMutation } = get();
    if (selectedEdgeIds.length === 0) return;

    set((state) => ({
      edges: state.edges.filter((edge) => !selectedEdgeIds.includes(edge.id)),
      selectedEdgeIds: [],
    }));

    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  copySelected: () => {
    const { nodes, edges, selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;

    const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
    const relatedEdges = edges.filter(
      (edge) => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
    );

    set({
      clipboard: {
        nodes: deepCloneCanvasValue(selectedNodes),
        edges: deepCloneCanvasValue(relatedEdges),
      },
    });
  },

  cutSelected: () => {
    const { copySelected, deleteSelected } = get();
    copySelected();
    deleteSelected();
  },

  paste: (position) => {
    const { clipboard, _pushHistory, _recordMutation } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    const idMap = new Map<string, string>();
    const offsetX = position ? position.x - clipboard.nodes[0].position.x : 50;
    const offsetY = position ? position.y - clipboard.nodes[0].position.y : 50;
    const clonedNodes = cloneNodes(clipboard.nodes);

    const remappedNodes = clonedNodes.map((node) => {
      const newId = generateId();
      idMap.set(node.id, newId);
      return createNode({
        ...node,
        id: newId,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
        selected: true,
      } as AppNode);
    }).map((node) => {
      if (node.type !== 'group') return node;
      const groupData = node.data as GroupNodeData;
      return createNode({
        ...node,
        data: {
          ...groupData,
          childNodeIds: remapChildNodeIds(groupData.childNodeIds, idMap),
        },
      } as AppNode);
    });

    const newEdges = cloneEdges(clipboard.edges).map((edge) => ({
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }));

    set((state) => ({
      nodes: [...state.nodes, ...normalizeAppNodes(remappedNodes)] as AppNode[],
      edges: [...state.edges, ...newEdges],
      selectedNodeIds: remappedNodes.map((node) => node.id),
    }));

    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  deleteSelected: () => {
    const { selectedNodeIds, _pushHistory, _recordMutation } = get();
    if (selectedNodeIds.length === 0) return;

    set((state) => ({
      nodes: state.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: state.edges.filter(
        (edge) => !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
      ),
      selectedNodeIds: [],
    }));

    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  duplicateSelected: () => {
    const { copySelected, paste, nodes, selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;

    copySelected();

    const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
    const avgX = selectedNodes.reduce((sum, node) => sum + node.position.x, 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((sum, node) => sum + node.position.y, 0) / selectedNodes.length;

    paste({ x: avgX + 50, y: avgY + 50 });
  },

  groupSelected: () => {
    const { nodes, selectedNodeIds, _pushHistory, _recordMutation } = get();
    const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id) && node.type !== 'group');
    if (selectedNodes.length < 2) return;

    const padding = 40;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of selectedNodes) {
      const width = node.measured?.width || 280;
      const height = node.measured?.height || 150;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    }

    const groupNode = createGroupNode(
      { x: minX - padding, y: minY - padding },
      `Group ${nodes.filter((node) => node.type === 'group').length + 1}`
    );

    (groupNode.data as GroupNodeData).width = maxX - minX + padding * 2;
    (groupNode.data as GroupNodeData).height = maxY - minY + padding * 2;
    (groupNode.data as GroupNodeData).childNodeIds = selectedNodes.map((node) => node.id);

    set((state) => ({
      nodes: [groupNode, ...state.nodes] as AppNode[],
    }));

    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  undo: () => {
    const { history, historyIndex, _recordMutation } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const snapshot = history[newIndex];

    set({
      nodes: cloneNodes(snapshot.nodes),
      edges: cloneEdges(snapshot.edges),
      historyIndex: newIndex,
    });

    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  redo: () => {
    const { history, historyIndex, _recordMutation } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const snapshot = history[newIndex];

    set({
      nodes: cloneNodes(snapshot.nodes),
      edges: cloneEdges(snapshot.edges),
      historyIndex: newIndex,
    });

    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  runAll: async () => {
    const { nodes, updateNodeData, getConnectedInputs } = get();
    const history = useSettingsStore.getState();
    const generators = nodes.filter((node) => node.type === 'imageGenerator');

    if (generators.length === 0) return;

    set({ isRunningAll: true });

    for (const generator of generators) {
      const data = generator.data as ImageGeneratorNodeData;
      const connectedInputs = getConnectedInputs(generator.id);
      if (!hasValidImagePromptInput(data, connectedInputs)) continue;

      if (data.compareEnabled && (data.compareModels?.length || 0) >= 2) {
        try {
          await startImageCompare({
            nodeId: generator.id,
            data,
            connectedInputs,
            updateNodeData,
            history: {
              addToHistory: history.addToHistory,
              updateHistoryItem: history.updateHistoryItem,
            },
          });
        } catch (error) {
          updateNodeData(
            generator.id,
            {
              error: normalizeApiErrorMessage(error, 'Compare failed'),
              compareRunStatus: 'failed',
            },
            { history: 'skip', save: 'skip', preview: 'skip', kind: 'runtime' }
          );
        }
        continue;
      }

      const requestBody = buildImageGenerationRequest(data, connectedInputs);
      const finalPrompt = buildImagePrompt(data, connectedInputs);

      updateNodeData(
        generator.id,
        { isGenerating: true, error: undefined, compareRunStatus: 'idle' },
        { history: 'skip', save: 'skip', preview: 'skip', kind: 'runtime' }
      );

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const message = await getApiErrorMessage(response, 'Generation failed');
          throw new Error(message);
        }

        const result = await response.json();
        const imageUrls: string[] = result.imageUrls || [result.imageUrl];

        updateNodeData(
          generator.id,
          {
            outputUrl: imageUrls[0],
            outputUrls: imageUrls,
            isGenerating: false,
          },
          { kind: 'output' }
        );

        history.addToHistory({
          type: 'image',
          mode: 'single',
          prompt: finalPrompt,
          model: data.model,
          status: 'completed',
          result: { urls: imageUrls },
          settings: {
            aspectRatio: data.aspectRatio,
            imageCount: data.imageCount || 1,
            ...(data.style && { style: data.style }),
            ...(data.resolution && { resolution: data.resolution }),
            ...(data.imageSize && { imageSize: data.imageSize }),
          },
        });
      } catch (error) {
        const errorMessage = normalizeApiErrorMessage(error, 'Generation failed');

        updateNodeData(
          generator.id,
          {
            error: errorMessage,
            isGenerating: false,
          },
          { history: 'skip', kind: 'output', preview: 'skip' }
        );

        history.addToHistory({
          type: 'image',
          mode: 'single',
          prompt: finalPrompt || data.prompt || '(no prompt)',
          model: data.model,
          status: 'failed',
          error: errorMessage,
          settings: {
            aspectRatio: data.aspectRatio,
            imageCount: data.imageCount || 1,
          },
        });
      }
    }

    set({ isRunningAll: false });
  },

  openSettingsPanel: (nodeId, position) => {
    set({ settingsPanelNodeId: nodeId, settingsPanelPosition: position });
  },

  closeSettingsPanel: () => {
    set({ settingsPanelNodeId: null, settingsPanelPosition: null });
  },

  openVideoSettingsPanel: (nodeId, position) => {
    set({ videoSettingsPanelNodeId: nodeId, videoSettingsPanelPosition: position });
  },

  closeVideoSettingsPanel: () => {
    set({ videoSettingsPanelNodeId: null, videoSettingsPanelPosition: null });
  },

  showContextMenu: (x, y, type) => {
    set({ contextMenu: { x, y, type } });
  },

  hideContextMenu: () => {
    set({ contextMenu: null });
  },

  setShowShortcuts: (show) => {
    set({ showShortcuts: show });
  },

  setActiveTool: (tool) => {
    set({ activeTool: tool, selectedEdgeIds: [] });
  },

  setReactFlowInstance: (instance) => {
    set({ reactFlowInstance: instance });
  },

  setCanvasDetailLevel: (level) => {
    if (get().canvasDetailLevel === level) return;
    set({ canvasDetailLevel: level });
  },

  getViewportCenter: () => {
    const { reactFlowInstance, spawnOffsetIndex } = get();
    if (!reactFlowInstance) {
      return { x: 200, y: 200 };
    }

    const { x, y, zoom } = reactFlowInstance.getViewport();
    const domNode = document.querySelector('.react-flow');
    const rect = domNode?.getBoundingClientRect();

    if (!rect) {
      return { x: 200, y: 200 };
    }

    const centerX = (-x + rect.width / 2) / zoom;
    const centerY = (-y + rect.height / 2) / zoom;

    const GRID_SIZE = 4;
    const STEP = 44;
    const col = spawnOffsetIndex % GRID_SIZE;
    const row = Math.floor(spawnOffsetIndex / GRID_SIZE) % GRID_SIZE;
    const half = (GRID_SIZE - 1) / 2;

    set({ spawnOffsetIndex: (spawnOffsetIndex + 1) % (GRID_SIZE * GRID_SIZE) });

    return {
      x: centerX + (col - half) * STEP,
      y: centerY + (row - half) * STEP,
    };
  },

  getNode: (nodeId) => get().nodes.find((node) => node.id === nodeId),

  getConnectedInputs: (nodeId) => {
    const { nodes, edges } = get();
    const incomingEdges = edges.filter((edge) => edge.target === nodeId);

    const getImageUrl = (node: AppNode | null | undefined, sourceHandle?: string | null): string | undefined => {
      if (!node) return undefined;
      if (node.type === 'media') {
        const mediaData = node.data as MediaNodeData;
        return mediaData.type === 'image' ? mediaData.url : undefined;
      }
      if (node.type === 'imageGenerator') {
        return (node.data as ImageGeneratorNodeData).outputUrl;
      }
      if (node.type === 'pluginNode') {
        const pluginData = node.data as PluginNodeData;
        if (pluginData.pluginId === 'svg-studio') {
          if (sourceHandle === 'code-output') return undefined;
          const nodeData = node.data as Record<string, unknown>;
          const state = pluginData.state as { asset?: { url?: string } } | undefined;
          return (nodeData.outputUrl as string | undefined) || state?.asset?.url;
        }
      }
      return undefined;
    };

    const getVideoUrl = (node: AppNode | null | undefined, sourceHandle?: string | null): string | undefined => {
      if (!node) return undefined;
      if (node.type === 'media') {
        const mediaData = node.data as MediaNodeData;
        return mediaData.type === 'video' ? mediaData.url : undefined;
      }
      if (node.type === 'videoGenerator') {
        return (node.data as VideoGeneratorNodeData).outputUrl;
      }
      if (node.type === 'videoAudio') {
        return (node.data as VideoAudioNodeData).outputUrl;
      }
      if (node.type === 'pluginNode') {
        const pluginData = node.data as PluginNodeData;
        if (pluginData.pluginId === 'animation-generator') {
          if (sourceHandle && sourceHandle !== 'video') return undefined;
          const state = pluginData.state as {
            preview?: { videoUrl?: string };
            output?: { videoUrl?: string };
            versions?: Array<{ videoUrl: string }>;
          } | undefined;
          return state?.output?.videoUrl || state?.preview?.videoUrl || state?.versions?.[state.versions.length - 1]?.videoUrl;
        }
      }
      return undefined;
    };

    const getVideoId = (node: AppNode | null | undefined): string | undefined => {
      if (!node) return undefined;
      if (node.type === 'videoGenerator') {
        return (node.data as VideoGeneratorNodeData).outputVideoId;
      }
      return undefined;
    };

    const getAudioUrl = (node: AppNode | null | undefined): string | undefined => {
      if (!node) return undefined;
      if (node.type === 'media') {
        const mediaData = node.data as MediaNodeData;
        return mediaData.type === 'audio' ? mediaData.url : undefined;
      }
      if (node.type === 'musicGenerator') {
        return (node.data as MusicGeneratorNodeData).outputUrl;
      }
      if (node.type === 'speech') {
        return (node.data as SpeechNodeData).outputUrl;
      }
      return undefined;
    };

    const textEdge = incomingEdges.find((edge) => edge.targetHandle === 'text');
    const referenceHandleEdges = incomingEdges.filter((edge) => edge.targetHandle === 'reference');
    const firstFrameEdge = incomingEdges.find((edge) => edge.targetHandle === 'firstFrame');
    const lastFrameEdge = incomingEdges.find((edge) => edge.targetHandle === 'lastFrame');
    const productImageEdge = incomingEdges.find((edge) => edge.targetHandle === 'productImage');
    const characterImageEdge = incomingEdges.find((edge) => edge.targetHandle === 'characterImage');
    const videoEdge = incomingEdges.find((edge) => edge.targetHandle === 'video');
    const audioEdge = incomingEdges.find((edge) => edge.targetHandle === 'audio');

    const referenceImageUrls: Record<string, string> = {};
    for (let refIndex = 0; refIndex <= 7; refIndex += 1) {
      const handleId = `refImage_${refIndex}`;
      const edge = incomingEdges.find((candidate) => candidate.targetHandle === handleId);
      if (!edge) continue;
      const node = nodes.find((candidate) => candidate.id === edge.source);
      const url = getImageUrl(node);
      if (url) referenceImageUrls[handleId] = url;
    }

    if (productImageEdge && !referenceImageUrls.refImage_0) {
      const node = nodes.find((candidate) => candidate.id === productImageEdge.source);
      const url = getImageUrl(node);
      if (url) referenceImageUrls.refImage_0 = url;
    }

    if (characterImageEdge && !referenceImageUrls.refImage_1) {
      const node = nodes.find((candidate) => candidate.id === characterImageEdge.source);
      const url = getImageUrl(node);
      if (url) referenceImageUrls.refImage_1 = url;
    }

    const legacyRefEdges = [
      'ref1',
      'ref2',
      'ref3',
      'ref4',
      'ref5',
      'ref6',
      'ref7',
      'ref8',
      'ref9',
      'ref10',
      'ref11',
      'ref12',
      'ref13',
      'ref14',
    ]
      .map((handle) => incomingEdges.find((edge) => edge.targetHandle === handle))
      .filter(Boolean);

    const textNode = textEdge ? nodes.find((node) => node.id === textEdge.source) : null;
    const firstFrameNode = firstFrameEdge ? nodes.find((node) => node.id === firstFrameEdge.source) : null;
    const lastFrameNode = lastFrameEdge ? nodes.find((node) => node.id === lastFrameEdge.source) : null;
    const productImageNode = productImageEdge ? nodes.find((node) => node.id === productImageEdge.source) : null;
    const characterImageNode = characterImageEdge ? nodes.find((node) => node.id === characterImageEdge.source) : null;
    const videoNode = videoEdge ? nodes.find((node) => node.id === videoEdge.source) : null;
    const audioNode = audioEdge ? nodes.find((node) => node.id === audioEdge.source) : null;

    const allReferenceUrls = [...referenceHandleEdges, ...legacyRefEdges]
      .map((edge) => {
        const node = edge ? nodes.find((candidate) => candidate.id === edge.source) : null;
        return getImageUrl(node, edge?.sourceHandle);
      })
      .filter((url): url is string => Boolean(url));

    const dedupedReferenceUrls = Array.from(new Set(allReferenceUrls));
    let resolvedTextContent: string | undefined;

    if (textNode) {
      if (textNode.type === 'pluginNode') {
        const pluginData = textNode.data as PluginNodeData;
        const isPromptOutput =
          textEdge?.sourceHandle === 'prompt-output'
          || (!textEdge?.sourceHandle && pluginData.pluginId === 'prompt-studio');
        if (isPromptOutput) {
          const state = pluginData.state as {
            activePromptId?: string;
            generatedPrompts?: Array<{ id: string; prompt: string }>;
          };
          const prompts = state.generatedPrompts;
          if (prompts?.length) {
            const activePrompt = state.activePromptId
              ? prompts.find((prompt) => prompt.id === state.activePromptId)
              : prompts[prompts.length - 1];
            resolvedTextContent = activePrompt?.prompt;
          }
        }
      } else {
        resolvedTextContent = (textNode.data as TextNodeData)?.content;
      }
    }

    return {
      textContent: resolvedTextContent,
      referenceUrl: dedupedReferenceUrls[0],
      firstFrameUrl: getImageUrl(firstFrameNode, firstFrameEdge?.sourceHandle),
      lastFrameUrl: getImageUrl(lastFrameNode, lastFrameEdge?.sourceHandle),
      referenceUrls: dedupedReferenceUrls.length > 1 ? dedupedReferenceUrls.slice(1) : undefined,
      productImageUrl: getImageUrl(productImageNode),
      characterImageUrl: getImageUrl(characterImageNode),
      referenceImageUrls: Object.keys(referenceImageUrls).length > 0 ? referenceImageUrls : undefined,
      videoUrl: getVideoUrl(videoNode),
      videoId: getVideoId(videoNode),
      audioUrl: getAudioUrl(audioNode),
    };
  },

  clearCanvas: () => {
    const { _pushHistory, _recordMutation } = get();
    set({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
      spawnOffsetIndex: 0,
    });
    _pushHistory();
    _recordMutation({ history: 'skip', kind: 'graph' });
  },

  loadCanvasData: (nodes, edges) => {
    set({
      nodes: cloneNodes(nodes),
      edges: cloneEdges(edges),
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
      spawnOffsetIndex: 0,
      canvasDetailLevel: 'full',
      lastMutation: null,
    });
    get()._pushHistory();
  },

  setReadOnly: (readOnly) => {
    set({ isReadOnly: readOnly });
  },

  loadAsReadOnly: (nodes, edges) => {
    set({
      nodes: cloneNodes(nodes),
      edges: cloneEdges(edges),
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
      spawnOffsetIndex: 0,
      canvasDetailLevel: 'full',
      lastMutation: null,
    });
  },

  duplicateToEditable: () => {
    const { nodes, edges } = get();
    const idMap = new Map<string, string>();

    const newNodes = cloneNodes(nodes).map((node) => {
      const newId = generateId();
      idMap.set(node.id, newId);
      return createNode({ ...node, id: newId } as AppNode);
    }).map((node) => {
      if (node.type !== 'group') return node;
      const groupData = node.data as GroupNodeData;
      return createNode({
        ...node,
        data: {
          ...groupData,
          childNodeIds: remapChildNodeIds(groupData.childNodeIds, idMap),
        },
      } as AppNode);
    });

    const newEdges = cloneEdges(edges).map((edge) => ({
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }));

    set({
      nodes: normalizeAppNodes(newNodes),
      edges: newEdges,
      isReadOnly: false,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      history: [],
      historyIndex: -1,
      lastMutation: null,
    });

    get()._pushHistory();
  },
}));
