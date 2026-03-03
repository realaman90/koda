import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';

const PLUGIN_ID = 'image-to-pdf';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_IMAGES = 100;
const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const PAGE_MARGIN = 24;

interface ImageToPdfRequestBody {
  imageUrls?: string[];
  fileName?: string;
}

function ensurePdfFileName(name: string | undefined): string {
  const fallback = `canvas-images-${Date.now()}.pdf`;
  if (!name) return fallback;

  const trimmed = name.trim();
  if (!trimmed) return fallback;
  const safe = trimmed.replace(/[^a-zA-Z0-9._ -]/g, '-');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function normalizeImageUrl(rawUrl: string, requestUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('data:')) {
    return rawUrl;
  }
  return new URL(rawUrl, requestUrl).toString();
}

function detectImageFormat(contentType: string | null, bytes: Uint8Array): 'png' | 'jpg' | null {
  const type = contentType?.toLowerCase() || '';
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';

  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'jpg';
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const policyDecision = evaluatePluginLaunchById(PLUGIN_ID);
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/image-to-pdf' },
    });

    if (!policyDecision.allowed) {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: PLUGIN_ID,
        errorCode: policyDecision.code,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Plugin launch blocked by policy.',
          code: policyDecision.code,
          reason: policyDecision.reason,
        },
        { status: policyDecision.code === 'PLUGIN_NOT_FOUND' ? 404 : 403 }
      );
    }

    const body = (await request.json()) as ImageToPdfRequestBody;
    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      : [];

    if (imageUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one image URL is required.' }, { status: 400 });
    }

    if (imageUrls.length > MAX_IMAGES) {
      return NextResponse.json(
        { success: false, error: `Too many images. Maximum is ${MAX_IMAGES}.` },
        { status: 400 }
      );
    }

    const normalizedUrls = imageUrls.map((url) => normalizeImageUrl(url, request.url));
    const pdf = await PDFDocument.create();

    for (let index = 0; index < normalizedUrls.length; index += 1) {
      const url = normalizedUrls[index];
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`Failed to fetch image ${index + 1}: HTTP ${response.status}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const format = detectImageFormat(response.headers.get('content-type'), bytes);
      if (!format) {
        throw new Error(
          `Unsupported image format at position ${index + 1}. Use PNG or JPG files for PDF export.`
        );
      }

      const image = format === 'png'
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);

      const [pageWidth, pageHeight] = image.width >= image.height ? A4_LANDSCAPE : A4_PORTRAIT;
      const page = pdf.addPage([pageWidth, pageHeight]);

      const maxWidth = pageWidth - PAGE_MARGIN * 2;
      const maxHeight = pageHeight - PAGE_MARGIN * 2;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;

      page.drawImage(image, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });
    }

    const fileName = ensurePdfFileName(body.fileName);
    const pdfBytes = await pdf.save();

    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'success',
      source: 'api',
      pluginId: PLUGIN_ID,
      metadata: { imageCount: normalizedUrls.length },
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: PLUGIN_ID,
      errorCode: 'execution_failed',
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      },
      { status: 500 }
    );
  }
}
