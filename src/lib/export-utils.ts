import { getExtensionFromUrl } from './assets/types';
import type {
  AppNode,
  AppEdge,
  ImageGeneratorNodeData,
  MediaNodeData,
  MusicGeneratorNodeData,
  PluginNodeData,
  SpeechNodeData,
  VideoAudioNodeData,
  VideoGeneratorNodeData,
} from './types';

// Helper to download a blob
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

type ExportableAssetKind = 'image' | 'video' | 'audio' | 'file';

interface ExportableAssetEntry {
  url: string;
  kind: ExportableAssetKind;
  baseName: string;
}

function sanitizeFilenamePart(value: string | undefined): string {
  const normalized = (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'asset';
}

function inferNodeName(node: AppNode): string {
  const rawName = (node.data as { name?: unknown }).name;
  if (typeof rawName === 'string' && rawName.trim()) {
    return rawName.trim();
  }

  switch (node.type) {
    case 'imageGenerator':
      return 'image-generator';
    case 'videoGenerator':
      return 'video-generator';
    case 'musicGenerator':
      return 'music-generator';
    case 'speech':
      return 'speech';
    case 'videoAudio':
      return 'video-audio';
    case 'pluginNode':
      return 'plugin-output';
    default:
      return node.type;
  }
}

function collectNodeAssets(node: AppNode): ExportableAssetEntry[] {
  const nodeName = sanitizeFilenamePart(inferNodeName(node));

  switch (node.type) {
    case 'media': {
      const data = node.data as MediaNodeData;
      if (!data.url) return [];

      return [{
        url: data.url,
        kind: data.type || 'file',
        baseName: nodeName,
      }];
    }

    case 'imageGenerator': {
      const data = node.data as ImageGeneratorNodeData;
      const urls = Array.from(new Set([...(data.outputUrls || []), ...(data.outputUrl ? [data.outputUrl] : [])]));

      return urls.map((url, index) => ({
        url,
        kind: 'image' as const,
        baseName: `${nodeName}-${index + 1}`,
      }));
    }

    case 'videoGenerator': {
      const data = node.data as VideoGeneratorNodeData;
      return data.outputUrl ? [{ url: data.outputUrl, kind: 'video', baseName: nodeName }] : [];
    }

    case 'videoAudio': {
      const data = node.data as VideoAudioNodeData;
      return data.outputUrl ? [{ url: data.outputUrl, kind: 'video', baseName: nodeName }] : [];
    }

    case 'musicGenerator': {
      const data = node.data as MusicGeneratorNodeData;
      return data.outputUrl ? [{ url: data.outputUrl, kind: 'audio', baseName: nodeName }] : [];
    }

    case 'speech': {
      const data = node.data as SpeechNodeData;
      return data.outputUrl ? [{ url: data.outputUrl, kind: 'audio', baseName: nodeName }] : [];
    }

    case 'pluginNode': {
      const data = node.data as PluginNodeData;

      if (data.pluginId === 'svg-studio') {
        const nodeData = node.data as Record<string, unknown>;
        const state = data.state as { asset?: { url?: string } } | undefined;
        const url = (nodeData.outputUrl as string | undefined) || state?.asset?.url;
        return url ? [{ url, kind: 'image', baseName: nodeName }] : [];
      }

      if (data.pluginId === 'animation-generator') {
        const state = data.state as {
          preview?: { videoUrl?: string };
          output?: { videoUrl?: string };
          versions?: Array<{ videoUrl: string }>;
        } | undefined;
        const url = state?.output?.videoUrl || state?.preview?.videoUrl || state?.versions?.[state.versions.length - 1]?.videoUrl;
        return url ? [{ url, kind: 'video', baseName: nodeName }] : [];
      }

      return [];
    }

    default:
      return [];
  }
}

function buildDownloadFilename(
  entry: ExportableAssetEntry,
  canvasName: string,
  usedBaseNames: Map<string, number>
): string {
  const extension = getExtensionFromUrl(entry.url);
  const fallbackExtension = entry.kind === 'video'
    ? 'mp4'
    : entry.kind === 'audio'
      ? 'mp3'
      : entry.kind === 'image'
        ? 'png'
        : 'bin';
  const resolvedExtension = extension !== 'bin' ? extension : fallbackExtension;
  const canvasSlug = sanitizeFilenamePart(canvasName || 'canvas');
  const baseName = `${canvasSlug}-${sanitizeFilenamePart(entry.baseName)}`;
  const currentCount = usedBaseNames.get(baseName) || 0;
  usedBaseNames.set(baseName, currentCount + 1);
  const uniqueBaseName = currentCount === 0 ? baseName : `${baseName}-${currentCount + 1}`;

  return `${uniqueBaseName}.${resolvedExtension}`;
}

export async function exportNodeAssets(
  nodes: AppNode[],
  canvasName: string,
  options?: { selectedNodeIds?: string[] }
): Promise<number> {
  const selectedNodeIds = options?.selectedNodeIds?.length ? new Set(options.selectedNodeIds) : null;
  const scopedNodes = selectedNodeIds ? nodes.filter((node) => selectedNodeIds.has(node.id)) : nodes;
  const uniqueAssets = new Map<string, ExportableAssetEntry>();

  for (const node of scopedNodes) {
    for (const asset of collectNodeAssets(node)) {
      if (!uniqueAssets.has(asset.url)) {
        uniqueAssets.set(asset.url, asset);
      }
    }
  }

  if (uniqueAssets.size === 0) {
    return 0;
  }

  const usedBaseNames = new Map<string, number>();
  for (const asset of uniqueAssets.values()) {
    const filename = buildDownloadFilename(asset, canvasName, usedBaseNames);
    const proxyUrl = `/api/download?url=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(filename)}`;
    const anchor = document.createElement('a');
    anchor.href = proxyUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }

  return uniqueAssets.size;
}

// Export canvas as JSON workflow
export const exportAsJSON = (
  nodes: AppNode[],
  edges: AppEdge[],
  spaceName: string
) => {
  const data = {
    version: '1.0',
    spaceName,
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  const filename = `${spaceName.replace(/\s+/g, '-').toLowerCase()}-workflow.json`;
  downloadBlob(blob, filename);
};

// Export canvas as PNG screenshot
export const exportAsPNG = async (
  canvasElement: HTMLElement,
  spaceName: string
) => {
  try {
    const { toPng } = await import('html-to-image');

    const dataUrl = await toPng(canvasElement, {
      backgroundColor: '#09090b',
      cacheBust: true,
      pixelRatio: 2,
      skipFonts: true,
      imagePlaceholder:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
      filter: (node: HTMLElement) => {
        if (node.tagName) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'iframe') return false;
        }
        if (node.classList) {
          if (
            node.classList.contains('react-flow__minimap') ||
            node.classList.contains('react-flow__controls') ||
            node.classList.contains('react-flow__panel')
          ) return false;
        }
        return true;
      },
    });

    // Convert data URL to blob
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
    const bytes = atob(base64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    const blob = new Blob([buf], { type: mime });

    const filename = `${spaceName.replace(/\s+/g, '-').toLowerCase()}-canvas.png`;
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to export as PNG:', error);
    throw error;
  }
};
