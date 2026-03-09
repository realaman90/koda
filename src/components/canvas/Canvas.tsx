'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ConnectionLineType,
  PanOnScrollMode,
  SelectionMode,
  useOnViewportChange,
  type OnSelectionChangeFunc,
  type IsValidConnection,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, createStoryboardNode, createProductShotNode, createPluginNode, createMediaNode } from '@/stores/canvas-store';
import type { AppEdge, AppNode, ImageGeneratorNodeData, ImageModelType, MediaNodeData, PluginNodeData } from '@/lib/types';
import { MODEL_CAPABILITIES } from '@/lib/types';
import { useSettingsStore } from '@/stores/settings-store';
import { useAppStore } from '@/stores/app-store';
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
import { pluginRegistry } from '@/lib/plugins/registry';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { toast } from 'sonner';
import { uploadAsset } from '@/lib/assets/upload';
import { useCanvasPersistenceController } from './useCanvasPersistenceController';
import { resolveCanvasDetailLevelFromZoom } from './nodes/useNodeDisplayMode';
import '@/lib/plugins/official/storyboard-generator';
import '@/lib/plugins/official/product-shot';
import '@/lib/plugins/official/agents/animation-generator';
import '@/lib/plugins/official/agents/motion-analyzer';
import '@/lib/plugins/official/agents/svg-studio';
import '@/lib/plugins/official/agents/prompt-studio';
import '@/lib/plugins/official/image-to-pdf';

export function Canvas() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const nodeCount = nodes.length;
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
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const setReactFlowInstance = useCanvasStore((state) => state.setReactFlowInstance);
  const setCanvasDetailLevel = useCanvasStore((state) => state.setCanvasDetailLevel);
  const canvasDetailLevel = useCanvasStore((state) => state.canvasDetailLevel);
  const currentCanvasId = useAppStore((state) => state.currentCanvasId);
  const gridSnap = useSettingsStore((state) => state.canvasPreferences.gridSnap);
  const showMinimap = useSettingsStore((state) => state.canvasPreferences.showMinimap);
  const theme = useSettingsStore((state) => state.theme);

  // Plugin sandbox state
  const { activePlugin, openSandbox, closeSandbox } = useAgentSandbox();

  // Get addNode and reactFlowInstance for creating nodes
  const addNode = useCanvasStore((state) => state.addNode);
  const reactFlowInstance = useCanvasStore((state) => state.reactFlowInstance);
  const detailLevelRef = useRef(canvasDetailLevel);
  const maskFrameRef = useRef<number | null>(null);
  const maskPointRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const viewportGestureRef = useRef(false);
  const backgroundMaskEnabled = canvasDetailLevel !== 'summary' && nodeCount <= 120;

  useCanvasPersistenceController();

  useEffect(() => {
    detailLevelRef.current = canvasDetailLevel;
  }, [canvasDetailLevel]);

  const applyBackgroundMask = useCallback((point?: { clientX: number; clientY: number } | null) => {
    const backgroundEl = containerRef.current?.querySelector('.react-flow__background') as HTMLElement | null;
    if (!backgroundEl) return;

    if (!backgroundMaskEnabled) {
      backgroundEl.style.maskImage = 'none';
      backgroundEl.style.webkitMaskImage = 'none';
      return;
    }

    if (!point) {
      backgroundEl.style.maskImage = 'radial-gradient(circle at 50% 50%, black 15%, transparent 40%)';
      backgroundEl.style.webkitMaskImage = 'radial-gradient(circle at 50% 50%, black 15%, transparent 40%)';
      return;
    }

    const rect = backgroundEl.getBoundingClientRect();
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    const gradient = `radial-gradient(circle at ${x}% ${y}%, black 15%, transparent 40%)`;
    backgroundEl.style.maskImage = gradient;
    backgroundEl.style.webkitMaskImage = gradient;
  }, [backgroundMaskEnabled]);

  useOnViewportChange({
    onStart: () => {
      viewportGestureRef.current = true;

      if (maskFrameRef.current !== null) {
        cancelAnimationFrame(maskFrameRef.current);
        maskFrameRef.current = null;
      }

      const backgroundEl = containerRef.current?.querySelector('.react-flow__background') as HTMLElement | null;
      if (backgroundEl && backgroundMaskEnabled) {
        backgroundEl.style.maskImage = 'none';
        backgroundEl.style.webkitMaskImage = 'none';
      }
    },
    onChange: (viewport) => {
      const nextDetailLevel = resolveCanvasDetailLevelFromZoom(viewport.zoom);
      if (detailLevelRef.current === nextDetailLevel) return;
      detailLevelRef.current = nextDetailLevel;
      setCanvasDetailLevel(nextDetailLevel);
    },
    onEnd: () => {
      viewportGestureRef.current = false;
      applyBackgroundMask(maskPointRef.current);
    },
  });

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes]);
  const incomingEdgesByTarget = useMemo(() => {
    const map = new Map<string, typeof edges>();
    for (const edge of edges) {
      const list = map.get(edge.target);
      if (list) {
        list.push(edge);
      } else {
        map.set(edge.target, [edge]);
      }
    }
    return map;
  }, [edges]);

  const defaultEdgeOptions = useMemo(
    () => ({
      style: { stroke: '#6366f1', strokeWidth: 2 },
      type: 'deletable' as const,
    }),
    []
  );
  const connectionLineStyle = useMemo(() => ({ stroke: '#6366f1', strokeWidth: 2 }), []);
  const snapGrid = useMemo<[number, number]>(() => [20, 20], []);
  const selectionKeyCode = useMemo(() => ['Shift'], []);
  const deleteKeyCode = useMemo(() => (isReadOnly ? [] : ['Backspace', 'Delete']), [isReadOnly]);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const handleCanvasDragOver = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnly) return;
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [isReadOnly]
  );

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnly) return;
      if (!event.dataTransfer?.files?.length) return;
      const targetElement = event.target as Element | null;
      if (targetElement?.closest('.react-flow__node')) return;

      event.preventDefault();
      event.stopPropagation();

      const files = Array.from(event.dataTransfer.files);
      const uploadable = files.filter(
        (file) =>
          file.type.startsWith('image/')
          || file.type.startsWith('video/')
          || file.type.startsWith('audio/')
      );

      if (uploadable.length === 0) {
        toast.error('Drop an image, video, or audio file');
        return;
      }

      if (uploadable.length < files.length) {
        toast.warning('Some dropped files were skipped (unsupported format)');
      }

      const dropPosition = reactFlowInstance
        ? reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: 400, y: 300 };

      uploadable.forEach(async (file, index) => {
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        const mediaType: 'image' | 'video' | 'audio' = isVideo ? 'video' : isAudio ? 'audio' : 'image';
        const node = createMediaNode({
          x: dropPosition.x + index * 40,
          y: dropPosition.y + index * 40,
        });

        try {
          const asset = await uploadAsset(file, {
            nodeId: node.id,
            canvasId: currentCanvasId || undefined,
          });
          node.data = { ...node.data, url: asset.url, type: mediaType };
          addNode(node);
        } catch (err) {
          console.error('[Canvas] Drop upload failed:', err);
          toast.error(`Upload failed: ${file.name}`);
        }
      });
    },
    [addNode, currentCanvasId, isReadOnly, reactFlowInstance]
  );

  // Handle plugin launch - create node for node-based plugins, open sandbox for others
  const handlePluginLaunch = useCallback(
    (pluginId: string) => {
      const plugin = pluginRegistry.get(pluginId);
      const decision = evaluatePluginLaunchById(pluginId);
      emitPluginPolicyAuditEvent({
        source: 'canvas',
        decision,
        metadata: { interaction: 'launch', pluginFound: !!plugin },
      });

      if (!decision.allowed) {
        toast.error(decision.reason);
        return;
      }

      // Create a canvas node at viewport center
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

      if (pluginId === 'storyboard-generator' || pluginId === 'product-shot') {
        const node = pluginId === 'product-shot'
          ? createProductShotNode(position, 'Product Shots')
          : createStoryboardNode(position, 'Storyboard');
        addNode(node);
        return;
      }

      if (plugin?.rendering?.mode === 'node') {
        const node = createPluginNode(position, pluginId, plugin.name);
        addNode(node);
        return;
      }

      openSandbox(pluginId);
    },
    [addNode, openSandbox, reactFlowInstance]
  );

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (maskFrameRef.current !== null) {
        cancelAnimationFrame(maskFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    applyBackgroundMask(maskPointRef.current);
  }, [applyBackgroundMask]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!backgroundMaskEnabled || viewportGestureRef.current) {
      return;
    }

    maskPointRef.current = { clientX: event.clientX, clientY: event.clientY };

    if (maskFrameRef.current !== null) {
      return;
    }

    maskFrameRef.current = requestAnimationFrame(() => {
      maskFrameRef.current = null;
      const point = maskPointRef.current;
      if (!point) return;
      applyBackgroundMask(point);
    });
  }, [applyBackgroundMask, backgroundMaskEnabled]);

  const handleInit = useCallback((instance: ReactFlowInstance<AppNode, AppEdge>) => {
    setReactFlowInstance(instance);
    const nextDetailLevel = resolveCanvasDetailLevelFromZoom(instance.getZoom());
    detailLevelRef.current = nextDetailLevel;
    setCanvasDetailLevel(nextDetailLevel);
  }, [setCanvasDetailLevel, setReactFlowInstance]);

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
      // If a concrete node is selected, drop background groups from active selection
      // so grouped canvases don't block node-level interactions.
      const hasNonGroupSelection = selectedNodes.some((node) => node.type !== 'group');
      const effectiveSelection = hasNonGroupSelection
        ? selectedNodes.filter((node) => node.type !== 'group')
        : selectedNodes;
      setSelectedNodes(effectiveSelection.map((n) => n.id));
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
      const sourceNode = nodeMap.get(connection.source) as AppNode | undefined;
      const targetNode = nodeMap.get(connection.target) as AppNode | undefined;
      if (!sourceNode || !targetNode) return false;
      const targetIncomingEdges = incomingEdgesByTarget.get(targetNode.id) ?? [];

      const sourcePluginData = sourceNode.type === 'pluginNode'
        ? (sourceNode.data as PluginNodeData)
        : null;
      const targetPluginData = targetNode.type === 'pluginNode'
        ? (targetNode.data as PluginNodeData)
        : null;
      const sourceMediaType = sourceNode.type === 'media'
        ? ((sourceNode.data as MediaNodeData).type || 'image')
        : null;
      const isSvgStudioSource = sourceNode.type === 'pluginNode'
        && sourcePluginData?.pluginId === 'svg-studio';
      const isSvgStudioImageSource = isSvgStudioSource && connection.sourceHandle !== 'code-output';
      const isAnimationVideoSource = sourceNode.type === 'pluginNode'
        && sourcePluginData?.pluginId === 'animation-generator'
        && connection.sourceHandle === 'video';
      const isImageSource =
        sourceNode.type === 'imageGenerator'
        || (sourceNode.type === 'media' && sourceMediaType === 'image')
        || isSvgStudioImageSource;
      const isVideoSource =
        sourceNode.type === 'videoGenerator'
        || sourceNode.type === 'videoAudio'
        || (sourceNode.type === 'media' && sourceMediaType === 'video')
        || isAnimationVideoSource;
      const isAudioSource =
        sourceNode.type === 'musicGenerator'
        || sourceNode.type === 'speech'
        || (sourceNode.type === 'media' && sourceMediaType === 'audio');

      // Image input handles - reference, firstFrame, lastFrame, legacy ref1-ref14
      const targetHandle = connection.targetHandle || '';

      // Animation node fallback: some custom handle compositions may not always report
      // targetHandle during drop. Allow typed media/code connections instead of hard-failing.
      if (targetNode.type === 'pluginNode'
        && targetPluginData?.pluginId === 'animation-generator'
        && !targetHandle) {
        const isSvgCodeSource = sourceNode.type === 'pluginNode'
          && sourcePluginData?.pluginId === 'svg-studio'
          && connection.sourceHandle === 'code-output';
        return isImageSource || isVideoSource || isSvgCodeSource;
      }
      const isImageHandle = ['reference', 'firstFrame', 'lastFrame'].includes(targetHandle) ||
        /^ref([1-9]|1[0-4])$/.test(targetHandle);
      if (isImageHandle) {
        if (!isImageSource) return false;

        // For image generator nodes
        if (targetNode.type === 'imageGenerator') {
          const model = (targetNode.data as ImageGeneratorNodeData).model as ImageModelType;
          const capabilities = MODEL_CAPABILITIES[model];
          if (!(capabilities.inputType === 'text-and-image' || capabilities.inputType === 'image-only')) {
            return false;
          }
          if (!capabilities.supportsReferences) return false;

          // Enforce per-model reference limits.
          const maxRefs = Math.max(1, capabilities.maxReferences || 1);
          const existingReferenceEdges = targetIncomingEdges.filter(
            (e) =>
              e.target === targetNode.id
              && (
                e.targetHandle === 'reference'
                || /^ref([1-9]|1[0-4])$/.test(e.targetHandle || '')
              )
          );
          const hasSameSourceAlreadyConnected = existingReferenceEdges.some(
            (e) => e.source === connection.source && (e.sourceHandle || '') === (connection.sourceHandle || '')
          );
          if (!hasSameSourceAlreadyConnected && existingReferenceEdges.length >= maxRefs) {
            return false;
          }
          return true;
        }

        // For video generator nodes - always allow if it's an image handle
        if (targetNode.type === 'videoGenerator') {
          return true;
        }
        // For plugin nodes with image reference handles (e.g. prompt-studio, svg-studio)
        if (targetNode.type === 'pluginNode') {
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

      // Text handle accepts text nodes and Prompt Studio plugin
      if (connection.targetHandle === 'text') {
        if (sourceNode.type === 'text') return true;
        if (
          sourceNode.type === 'pluginNode'
          && (connection.sourceHandle === 'prompt-output'
            || (
              !connection.sourceHandle
              && ['prompt-studio', 'motion-analyzer'].includes((sourceNode.data as PluginNodeData).pluginId)
            ))
        ) {
          return true;
        }
        return false;
      }

      // Video handle accepts only video sources
      if (targetHandle === 'video') {
        return isVideoSource;
      }

      // Audio handle accepts only audio sources
      if (targetHandle === 'audio') {
        return isAudioSource;
      }

      // Animation node video ref handles — allow only compatible video sources, only for Remotion engine
      if (targetHandle.startsWith('video-ref-')) {
        if (!isVideoSource) return false;
        // Block video connections to Theatre.js animation nodes
        if (targetNode.type === 'pluginNode') {
          const animData = targetNode.data as Record<string, unknown>;
          if (animData.engine === 'theatre') return false;
        }
        return true;
      }

      // Animation node image ref handles
      if (targetHandle.startsWith('image-ref-')) {
        return isImageSource;
      }

      // Animation node SVG code handle — only from SVG Studio code-output
      if (targetHandle === 'svg-code') {
        return sourceNode.type === 'pluginNode'
          && (sourceNode.data as Record<string, unknown>)?.pluginId === 'svg-studio'
          && connection.sourceHandle === 'code-output';
      }

      return true;
    },
    [incomingEdgesByTarget, nodeMap]
  );

  // Allow panning on empty canvas while Select tool is active.
  // Hold Shift + drag for marquee selection in scissors mode.
  const panEnabled = isReadOnly || activeTool === 'pan' || activeTool === 'select';
  const selectionOnDragEnabled = !isReadOnly && activeTool === 'scissors';

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ backgroundColor: 'var(--canvas-bg)' }} onMouseMove={handleMouseMove}>
      {!isReadOnly && (
        <>
          <NodeToolbar onPluginLaunch={handlePluginLaunch} />
          <WelcomeOverlay onPluginLaunch={handlePluginLaunch} />
          <SettingsPanel />
          <VideoSettingsPanel />
          <ContextMenu onPluginLaunch={handlePluginLaunch} />
          <KeyboardShortcuts />
        </>
      )}
      {activePlugin && (
        <AgentSandbox plugin={activePlugin} onClose={closeSandbox} />
      )}
      <ReactFlow
        colorMode={theme === 'system' ? 'system' : theme}
        nodes={nodes}
        edges={edges}
        onNodesChange={isReadOnly ? undefined : onNodesChange}
        onEdgesChange={isReadOnly ? undefined : onEdgesChange}
        onConnect={isReadOnly ? undefined : onConnect}
        onSelectionChange={isReadOnly ? undefined : onSelectionChange}
        onSelectionEnd={isReadOnly ? undefined : onSelectionEnd}
        onPaneClick={handlePaneClick}
        onContextMenu={isReadOnly ? undefined : handleContextMenu}
        onDragOver={isReadOnly ? undefined : handleCanvasDragOver}
        onDrop={isReadOnly ? undefined : handleCanvasDrop}
        onInit={handleInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isReadOnly ? undefined : isValidConnection}
        fitView
        className={`tool-${activeTool}`}
        style={{ backgroundColor: 'var(--canvas-bg)' }}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={connectionLineStyle}
        proOptions={proOptions}
        snapToGrid={gridSnap}
        snapGrid={snapGrid}
        panOnDrag={panEnabled}
        panActivationKeyCode={isReadOnly ? null : 'Space'}
        panOnScroll
        panOnScrollSpeed={0.9}
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch
        minZoom={0.25}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        edgesReconnectable={!isReadOnly}
        elevateNodesOnSelect={false}
        selectionOnDrag={selectionOnDragEnabled}
        selectionKeyCode={selectionKeyCode}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={deleteKeyCode}
        connectionRadius={30}
        selectNodesOnDrag={isReadOnly ? false : activeTool === 'select'}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.2}
          color="var(--canvas-dots)"
          style={backgroundMaskEnabled ? undefined : { maskImage: 'none', WebkitMaskImage: 'none' }}
        />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{ backgroundColor: 'var(--canvas-bg)' }}
          />
        )}
        <ZoomControls />
      </ReactFlow>
    </div>
  );
}
