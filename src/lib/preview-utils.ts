import { toPng } from 'html-to-image';

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;

// 1x1 dark-gray pixel used when an <img> fails to load (cross-origin, broken URL, etc.).
// Without this, a single tainted image kills the entire capture via Image.onerror → Event `{}`.
const IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

// Tags that carry cross-origin data and taint the intermediate canvas
// (toDataURL throws SecurityError: "Tainted canvases may not be exported").
const TAINTED_TAGS = new Set(['img', 'video', 'canvas', 'iframe']);

// Classes to exclude from capture — they contain dynamic masks, overlays, or
// interactive controls that break html-to-image's SVG foreignObject cloning.
const EXCLUDED_CLASSES = [
  'react-flow__minimap',
  'react-flow__controls',
  'react-flow__panel',
];

function shouldIncludeNode(node: HTMLElement): boolean {
  // Filter receives all DOM node types; only Element nodes have tagName/classList.
  if (node.tagName) {
    if (TAINTED_TAGS.has(node.tagName.toLowerCase())) return false;
  }
  if (node.classList) {
    for (const cls of EXCLUDED_CLASSES) {
      if (node.classList.contains(cls)) return false;
    }
  }
  return true;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export async function captureCanvasPreview(canvasElement: HTMLElement): Promise<Blob> {
  // toPng is more reliable than toBlob for React Flow's complex DOM
  // (SVG edges, CSS transforms, CSS variables, dynamic mask-image).
  const dataUrl = await toPng(canvasElement, {
    backgroundColor: '#09090b',
    width: canvasElement.offsetWidth,
    height: canvasElement.offsetHeight,
    cacheBust: true,
    skipFonts: true,
    imagePlaceholder: IMAGE_PLACEHOLDER,
    filter: shouldIncludeNode,
  });

  const sourceBlob = dataUrlToBlob(dataUrl);

  // Resize to 640x360 JPEG thumbnail
  const img = await createImageBitmap(sourceBlob);

  const output = document.createElement('canvas');
  output.width = PREVIEW_WIDTH;
  output.height = PREVIEW_HEIGHT;

  const ctx = output.getContext('2d');
  if (!ctx) {
    throw new Error('CAPTURE_FAILED');
  }

  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  // Fit source into 16:9 output (contain)
  const ratio = Math.min(PREVIEW_WIDTH / img.width, PREVIEW_HEIGHT / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  const x = (PREVIEW_WIDTH - width) / 2;
  const y = (PREVIEW_HEIGHT - height) / 2;
  ctx.drawImage(img, x, y, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    output.toBlob(resolve, 'image/jpeg', 0.78);
  });

  if (!blob) {
    throw new Error('CAPTURE_FAILED');
  }

  return blob;
}

export function makeThumbnailVersion(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function withThumbnailVersion(url: string, version?: string): string {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}
