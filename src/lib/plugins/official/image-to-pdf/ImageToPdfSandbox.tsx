'use client';

import * as React from 'react';
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
import type { AgentSandboxProps } from '@/lib/plugins/types';
import type { AppNode, ImageGeneratorNodeData, MediaNodeData } from '@/lib/types';
import { uploadAsset } from '@/lib/assets/upload';

interface OrderedImage {
  id: string;
  url: string;
  label: string;
  source: 'selected' | 'canvas' | 'upload';
}

const DEFAULT_FILE_NAME = 'canvas-images.pdf';

function ensurePdfFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_FILE_NAME;
  const safe = trimmed.replace(/[^a-zA-Z0-9._ -]/g, '-');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
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

  return [];
}

function extractOrderedImages(nodes: AppNode[], source: OrderedImage['source']): OrderedImage[] {
  const seen = new Set<string>();
  const images: OrderedImage[] = [];

  for (const node of nodes) {
    const nodeImages = readImagesFromNode(node, source);
    for (const image of nodeImages) {
      if (seen.has(image.url)) continue;
      seen.add(image.url);
      images.push(image);
    }
  }

  return images;
}

function parseDownloadFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || null;
}

export function ImageToPdfSandbox({ canvas, onClose, notify }: AgentSandboxProps) {
  const [images, setImages] = React.useState<OrderedImage[]>([]);
  const [fileName, setFileName] = React.useState(DEFAULT_FILE_NAME);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadFromSelection = React.useCallback(() => {
    const selected = canvas.getSelectedNodes();
    const extracted = extractOrderedImages(selected, 'selected');
    if (extracted.length === 0) {
      notify('No image outputs found in selected nodes.', 'info');
      return;
    }
    setImages(extracted);
    notify(`Loaded ${extracted.length} image${extracted.length === 1 ? '' : 's'} from selection.`, 'success');
  }, [canvas, notify]);

  const loadFromCanvas = React.useCallback(() => {
    const all = canvas.getNodes();
    const extracted = extractOrderedImages(all, 'canvas');
    if (extracted.length === 0) {
      notify('No image outputs found on this canvas.', 'info');
      return;
    }
    setImages(extracted);
    notify(`Loaded ${extracted.length} image${extracted.length === 1 ? '' : 's'} from canvas.`, 'success');
  }, [canvas, notify]);

  React.useEffect(() => {
    const selected = extractOrderedImages(canvas.getSelectedNodes(), 'selected');
    if (selected.length > 0) {
      setImages(selected);
      return;
    }
    const all = extractOrderedImages(canvas.getNodes(), 'canvas');
    setImages(all);
  }, [canvas]);

  const moveImage = React.useCallback((index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }, []);

  const removeImage = React.useCallback((id: string) => {
    setImages((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: OrderedImage[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const asset = await uploadAsset(file);
        uploaded.push({
          id: `upload:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
          url: asset.url,
          label: file.name || 'Uploaded image',
          source: 'upload',
        });
      }

      if (uploaded.length === 0) {
        notify('No valid image files were uploaded.', 'error');
        return;
      }

      setImages((prev) => [...prev, ...uploaded]);
      notify(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }, [notify]);

  const handleGeneratePdf = React.useCallback(async () => {
    if (images.length === 0 || isGenerating) return;

    const finalFileName = ensurePdfFileName(fileName);
    setIsGenerating(true);
    try {
      const response = await fetch('/api/plugins/image-to-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls: images.map((item) => item.url),
          fileName: finalFileName,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to create PDF' }));
        throw new Error(err.error || `Failed to create PDF (${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const serverName = parseDownloadFileName(response.headers.get('content-disposition'));
      anchor.href = objectUrl;
      anchor.download = serverName || finalFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      notify('PDF generated and downloaded.', 'success');
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to create PDF', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [fileName, images, isGenerating, notify, onClose]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">PDF file name</label>
        <input
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          placeholder={DEFAULT_FILE_NAME}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={loadFromSelection}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-muted/70 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Use Selected
        </button>
        <button
          onClick={loadFromCanvas}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-muted/70 transition-colors"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Use All Canvas Images
        </button>
        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-muted/70 transition-colors disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload Images
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadChange}
        className="hidden"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Page Order</h3>
          <span className="text-xs text-muted-foreground">{images.length} image{images.length === 1 ? '' : 's'}</span>
        </div>

        <div className="max-h-[320px] overflow-y-auto space-y-2 rounded-lg border border-border bg-muted/20 p-2">
          {images.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Add or load images to start building your PDF.
            </div>
          )}

          {images.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-popover px-2 py-2"
            >
              <div className="h-14 w-14 overflow-hidden rounded-md border border-border bg-muted/30 shrink-0">
                <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground capitalize">Source: {item.source}</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveImage(index, -1)}
                  disabled={index === 0}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveImage(index, 1)}
                  disabled={index === images.length - 1}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeImage(item.id)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-red-400"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleGeneratePdf}
          disabled={images.length === 0 || isGenerating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />}
          Generate PDF
        </button>
      </div>
    </div>
  );
}
