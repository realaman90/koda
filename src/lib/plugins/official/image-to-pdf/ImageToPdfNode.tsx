'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { PluginNodeData, AppNode, ImageGeneratorNodeData, MediaNodeData } from '@/lib/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { uploadAsset } from '@/lib/assets/upload';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDown,
  ArrowUp,
  FileOutput,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';

type PdfFitMode = 'contain' | 'cover';
type PdfPageMode =
  | 'image'
  | 'a0-auto'
  | 'a1-auto'
  | 'a4-auto'
  | 'letter-auto'
  | 'legal-auto'
  | 'a2-auto'
  | 'a3-auto'
  | 'a5-auto';

interface OrderedImage {
  id: string;
  url: string;
  label: string;
  source: 'connected' | 'selected' | 'canvas' | 'upload';
}

interface ImageToPdfNodeState {
  images: OrderedImage[];
  fileName: string;
  fitMode: PdfFitMode;
  pageMode: PdfPageMode;
  margin: number;
  isGenerating: boolean;
  error?: string;
}

const DEFAULT_FILE_NAME = 'canvas-images.pdf';
const PAGE_MODE_OPTIONS: Array<{ value: PdfPageMode; label: string }> = [
  { value: 'image', label: 'Page: Match image' },
  { value: 'a0-auto', label: 'Page: A0 auto' },
  { value: 'a1-auto', label: 'Page: A1 auto' },
  { value: 'a4-auto', label: 'Page: A4 auto' },
  { value: 'letter-auto', label: 'Page: Letter auto' },
  { value: 'legal-auto', label: 'Page: Legal auto' },
  { value: 'a2-auto', label: 'Page: A2 auto' },
  { value: 'a3-auto', label: 'Page: A3 auto' },
  { value: 'a5-auto', label: 'Page: A5 auto' },
];

function normalizePageMode(value: unknown): PdfPageMode {
  const mode = typeof value === 'string' ? value : '';
  return PAGE_MODE_OPTIONS.some((option) => option.value === mode)
    ? (mode as PdfPageMode)
    : 'image';
}

function createDefaultState(): ImageToPdfNodeState {
  return {
    images: [],
    fileName: DEFAULT_FILE_NAME,
    fitMode: 'contain',
    pageMode: 'image', // minimizes whitespace by default
    margin: 0,
    isGenerating: false,
    error: undefined,
  };
}

function ensurePdfFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_FILE_NAME;
  const safe = trimmed.replace(/[^a-zA-Z0-9._ -]/g, '-');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function parseDownloadFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || null;
}

function readImagesFromNode(node: AppNode, source: OrderedImage['source']): OrderedImage[] {
  if (node.type === 'media') {
    const media = node.data as MediaNodeData;
    if (media.type === 'image' && typeof media.url === 'string' && media.url.trim()) {
      return [{
        id: `${node.id}:0`,
        url: media.url.trim(),
        label: (node.data.name as string) || 'Media Image',
        source,
      }];
    }
    return [];
  }

  if (node.type === 'imageGenerator') {
    const data = node.data as ImageGeneratorNodeData;
    const urls = Array.isArray(data.outputUrls) && data.outputUrls.length > 0
      ? data.outputUrls
      : data.outputUrl
        ? [data.outputUrl]
        : [];

    return urls
      .map((url, index) => ({
        id: `${node.id}:${index}`,
        url: typeof url === 'string' ? url.trim() : '',
        label: `${(data.name as string) || 'Generated Image'}${urls.length > 1 ? ` #${index + 1}` : ''}`,
        source,
      }))
      .filter((entry) => entry.url.length > 0);
  }

  if (node.type === 'pluginNode') {
    const pluginNodeData = node.data as PluginNodeData & { outputUrl?: string };
    if (pluginNodeData.pluginId === 'svg-studio' && typeof pluginNodeData.outputUrl === 'string') {
      return [{
        id: `${node.id}:0`,
        url: pluginNodeData.outputUrl.trim(),
        label: (node.data.name as string) || 'SVG Output',
        source,
      }];
    }
  }

  return [];
}

function collectImages(nodes: AppNode[], source: OrderedImage['source']): OrderedImage[] {
  const images: OrderedImage[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const extracted = readImagesFromNode(node, source);
    for (const item of extracted) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      images.push(item);
    }
  }

  return images;
}

function areImageListsEqual(a: OrderedImage[], b: OrderedImage[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id
      || left.url !== right.url
      || left.label !== right.label
      || left.source !== right.source
    ) {
      return false;
    }
  }
  return true;
}

function reconcileConnectedImages(current: OrderedImage[], connected: OrderedImage[]): OrderedImage[] {
  const connectedById = new Map(connected.map((image) => [image.id, image]));
  const consumed = new Set<string>();
  const merged: OrderedImage[] = [];

  for (const image of current) {
    if (image.source !== 'connected') {
      merged.push(image);
      continue;
    }

    const nextConnected = connectedById.get(image.id);
    if (nextConnected) {
      merged.push(nextConnected);
      consumed.add(image.id);
    }
    // Drop stale connected entries that are no longer connected.
  }

  for (const image of connected) {
    if (!consumed.has(image.id)) {
      merged.push(image);
    }
  }

  return merged;
}

function ImageToPdfNodeComponent({ id, data, selected }: NodeProps<Node<PluginNodeData, 'pluginNode'>>) {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { displayMode, focusProps } = useNodeDisplayMode(selected);
  const stopPointerDown = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  const state = useMemo(() => {
    const defaults = createDefaultState();
    const persisted = (data.state as Partial<ImageToPdfNodeState> | undefined) || {};
    return {
      ...defaults,
      ...persisted,
      images: Array.isArray(persisted.images) ? persisted.images : defaults.images,
      fileName: typeof persisted.fileName === 'string' ? persisted.fileName : defaults.fileName,
      fitMode: persisted.fitMode === 'cover' ? 'cover' : 'contain',
      pageMode: normalizePageMode(persisted.pageMode),
      margin: Number.isFinite(persisted.margin) ? Math.max(0, Math.min(120, Number(persisted.margin))) : defaults.margin,
      isGenerating: Boolean(persisted.isGenerating),
      error: typeof persisted.error === 'string' ? persisted.error : undefined,
    } as ImageToPdfNodeState;
  }, [data.state]);

  const updateState = useCallback((patch: Partial<ImageToPdfNodeState>) => {
    const currentNode = useCanvasStore.getState().getNode(id);
    const currentState = (currentNode?.type === 'pluginNode'
      ? (currentNode.data as PluginNodeData).state as Partial<ImageToPdfNodeState> | undefined
      : undefined) || {};

    updateNodeData(id, {
      state: {
        ...createDefaultState(),
        ...currentState,
        ...patch,
      },
    });
  }, [id, updateNodeData]);

  const connectedImages = useMemo(() => {
    const incoming = edges.filter((edge) => edge.target === id);
    const connectedNodes = incoming
      .map((edge) => nodes.find((node) => node.id === edge.source))
      .filter((node): node is AppNode => Boolean(node));
    return collectImages(connectedNodes, 'connected');
  }, [edges, id, nodes]);

  const loadConnectedImages = useCallback(() => {
    const incoming = edges.filter((edge) => edge.target === id);
    const connectedNodes = incoming
      .map((edge) => nodes.find((node) => node.id === edge.source))
      .filter((node): node is AppNode => Boolean(node));
    const extracted = collectImages(connectedNodes, 'connected');

    if (extracted.length === 0) {
      toast.info('No connected image outputs found');
      return;
    }

    updateState({ images: extracted, error: undefined });
    toast.success(`Loaded ${extracted.length} connected image${extracted.length === 1 ? '' : 's'}`);
  }, [edges, id, nodes, updateState]);

  const loadSelectedImages = useCallback(() => {
    const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id) && node.id !== id);
    const extracted = collectImages(selectedNodes, 'selected');

    if (extracted.length === 0) {
      if (connectedImages.length > 0) {
        updateState({ images: connectedImages, error: undefined });
        toast.info('No selected image nodes found. Loaded connected inputs instead.');
        return;
      }
      toast.info('No image outputs found in selected nodes');
      return;
    }

    updateState({ images: extracted, error: undefined });
    toast.success(`Loaded ${extracted.length} selected image${extracted.length === 1 ? '' : 's'}`);
  }, [connectedImages, id, nodes, selectedNodeIds, updateState]);

  const loadCanvasImages = useCallback(() => {
    const canvasNodes = nodes.filter((node) => node.id !== id);
    const extracted = collectImages(canvasNodes, 'canvas');

    if (extracted.length === 0) {
      toast.info('No image outputs found on canvas');
      return;
    }

    updateState({ images: extracted, error: undefined });
    toast.success(`Loaded ${extracted.length} canvas image${extracted.length === 1 ? '' : 's'}`);
  }, [id, nodes, updateState]);

  useEffect(() => {
    const reconciled = reconcileConnectedImages(state.images, connectedImages);
    if (!areImageListsEqual(reconciled, state.images)) {
      updateState({ images: reconciled });
    }
  }, [connectedImages, state.images, updateState]);

  const moveImage = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.images.length) return;
    const copy = [...state.images];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    updateState({ images: copy });
  }, [state.images, updateState]);

  const removeImage = useCallback((imageId: string) => {
    updateState({ images: state.images.filter((item) => item.id !== imageId) });
  }, [state.images, updateState]);

  const handleUploadFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    updateState({ isGenerating: true, error: undefined });
    try {
      const uploaded: OrderedImage[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const asset = await uploadAsset(file, { nodeId: id });
        uploaded.push({
          id: `upload:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
          url: asset.url,
          label: file.name || 'Uploaded image',
          source: 'upload',
        });
      }

      if (uploaded.length === 0) {
        toast.error('No valid images uploaded');
      } else {
        updateState({ images: [...state.images, ...uploaded], error: undefined });
        toast.success(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? '' : 's'}`);
      }
    } catch (error) {
      updateState({ error: error instanceof Error ? error.message : 'Upload failed' });
      toast.error('Upload failed');
    } finally {
      updateState({ isGenerating: false });
      event.target.value = '';
    }
  }, [id, state.images, updateState]);

  const handleGeneratePdf = useCallback(async () => {
    if (state.images.length === 0 || state.isGenerating) return;

    const fileName = ensurePdfFileName(state.fileName);
    updateState({ isGenerating: true, error: undefined, fileName });
    try {
      const response = await fetch('/api/plugins/image-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: state.images.map((image) => image.url),
          fileName,
          fitMode: state.fitMode,
          pageMode: state.pageMode,
          margin: state.margin,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
        throw new Error(err.error || `Failed to generate PDF (${response.status})`);
      }

      const blob = await response.blob();
      const downloadName = parseDownloadFileName(response.headers.get('content-disposition')) || fileName;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      toast.success('PDF downloaded');
    } catch (error) {
      updateState({ error: error instanceof Error ? error.message : 'Failed to generate PDF' });
      toast.error('Failed to generate PDF');
    } finally {
      updateState({ isGenerating: false });
    }
  }, [state.fileName, state.fitMode, state.images, state.isGenerating, state.margin, state.pageMode, updateState]);

  const showHandles = selected || isHovered || state.images.length > 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...focusProps}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadFiles}
        className="hidden"
      />

      {selected && !isReadOnly && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg px-2 py-1.5 node-toolbar-floating z-10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            onClick={() => deleteNode(id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="mb-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--node-title-image)' }}>
        <FileOutput className="h-4 w-4" />
        <span>{(data.name as string) || 'Image to PDF'}</span>
      </div>

      <div
        className={`
          node-drag-handle node-drag-surface w-[420px] rounded-2xl overflow-hidden
          transition-all duration-150
          ${selected ? 'node-card node-card-selected' : 'node-card'}
        `}
      >
        {displayMode !== 'full' ? (
          <div className={`node-body min-h-[180px] ${displayMode === 'compact' ? 'node-compact' : 'node-summary'}`}>
            <div className="node-content-area rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground">PDF export</p>
              <p className="mt-1 text-sm text-foreground/85 line-clamp-4">
                {state.images.length > 0
                  ? `${state.images.length} image${state.images.length === 1 ? '' : 's'} queued for ${state.fileName || DEFAULT_FILE_NAME}.`
                  : 'Load or connect images to export them as a PDF.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{state.pageMode}</span>
              <span>{state.fitMode}</span>
              {state.images.length > 0 && <span>Ready to export</span>}
            </div>
          </div>
        ) : (
        <div className="p-3 space-y-3">
          <input
            value={state.fileName}
            onChange={(event) => updateState({ fileName: event.target.value })}
            placeholder={DEFAULT_FILE_NAME}
            className="w-full rounded-md border border-border bg-muted/60 px-2.5 py-1.5 text-xs text-foreground outline-none"
            disabled={isReadOnly || state.isGenerating}
          />

          <div className="grid grid-cols-2 gap-2">
            <Select value={state.pageMode} onValueChange={(value) => updateState({ pageMode: value as PdfPageMode })}>
              <SelectTrigger className="h-8 bg-muted/80 border-0 text-xs text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {PAGE_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={state.fitMode} onValueChange={(value) => updateState({ fitMode: value as PdfFitMode })}>
              <SelectTrigger className="h-8 bg-muted/80 border-0 text-xs text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="contain" className="text-xs">Fit: Contain</SelectItem>
                <SelectItem value="cover" className="text-xs">Fit: Fill/Crop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.pageMode !== 'image' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-11 shrink-0">Margin</span>
              <input
                type="number"
                min={0}
                max={120}
                value={state.margin}
                onChange={(event) => updateState({ margin: Math.max(0, Math.min(120, Number(event.target.value) || 0)) })}
                className="w-20 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs text-foreground outline-none"
                disabled={isReadOnly || state.isGenerating}
              />
              <span className="text-[11px] text-muted-foreground">px</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadConnectedImages}
              onMouseDown={stopPointerDown}
              disabled={isReadOnly || state.isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/70 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              Inputs
            </button>
            <button
              onClick={loadSelectedImages}
              onMouseDown={stopPointerDown}
              disabled={isReadOnly || state.isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/70 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
            >
              <ImageIcon className="h-3 w-3" />
              Selected
            </button>
            <button
              onClick={loadCanvasImages}
              onMouseDown={stopPointerDown}
              disabled={isReadOnly || state.isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/70 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
            >
              <ImageIcon className="h-3 w-3" />
              Canvas
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              onMouseDown={stopPointerDown}
              disabled={isReadOnly || state.isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/70 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
          </div>

          <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 space-y-2">
            {state.images.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Connect or load images, then reorder and export.
              </div>
            )}

            {state.images.map((image, index) => (
              <div key={image.id} className="flex items-center gap-2 rounded-md border border-border bg-popover px-2 py-2">
                <div className="h-11 w-11 overflow-hidden rounded border border-border shrink-0">
                  <img src={image.url} alt={image.label} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-foreground">{image.label}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{image.source}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0 || isReadOnly || state.isGenerating}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveImage(index, 1)}
                    disabled={index === state.images.length - 1 || isReadOnly || state.isGenerating}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeImage(image.id)}
                    disabled={isReadOnly || state.isGenerating}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {state.error && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}

          <Button
            onClick={handleGeneratePdf}
            disabled={isReadOnly || state.images.length === 0 || state.isGenerating}
            className="w-full h-9"
          >
            {state.isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />}
            {state.isGenerating ? 'Generating PDF...' : 'Generate PDF'}
          </Button>
        </div>
        )}
      </div>

      <div
        className={`absolute -left-3 top-[124px] z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="reference"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          Image input
        </span>
      </div>
    </div>
  );
}

export const ImageToPdfNode = memo(ImageToPdfNodeComponent);
