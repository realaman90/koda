import { z } from 'zod';

export const SVG_STUDIO_MAX_RAW_SIZE = 300_000;
export const SVG_STUDIO_MAX_ELEMENTS = 2_000;
export const SVG_STUDIO_MAX_PATHS = 1_000;
export const SVG_STUDIO_MAX_PATH_COMMAND_LENGTH = 100_000;
export const SVG_STUDIO_MAX_DIMENSION = 4096;

export const SvgStudioRequestSchema = z.object({
  action: z.enum(['generate', 'edit']),
  prompt: z.string().min(3).max(4000),
  svg: z.string().max(SVG_STUDIO_MAX_RAW_SIZE).optional(),
  constraints: z.object({
    width: z.number().int().min(16).max(SVG_STUDIO_MAX_DIMENSION).optional(),
    height: z.number().int().min(16).max(SVG_STUDIO_MAX_DIMENSION).optional(),
    viewBox: z.string().max(64).optional(),
    colorPalette: z.array(z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)).max(16).optional(),
    maxPaths: z.number().int().min(1).max(SVG_STUDIO_MAX_PATHS).default(300),
    forAnimation: z.boolean().default(true),
  }).optional(),
  persistAsset: z.boolean().default(true),
  nodeId: z.string().optional(),
  canvasId: z.string().optional(),
}).refine((v) => v.action !== 'edit' || !!v.svg, {
  message: 'svg is required for edit action',
  path: ['svg'],
});

export const SvgStudioAgentOutputSchema = z.object({
  svg: z.string().min(16).max(SVG_STUDIO_MAX_RAW_SIZE),
  warnings: z.array(z.string()).default([]),
});

export const SvgStudioResponseSchema = z.object({
  success: z.boolean(),
  svg: z.string(),
  metadata: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    viewBox: z.string().optional(),
    elementCount: z.number(),
    pathCount: z.number(),
    sanitized: z.boolean(),
    warnings: z.array(z.string()).default([]),
  }),
  asset: z.object({
    id: z.string(),
    url: z.string(),
    mimeType: z.literal('image/svg+xml'),
    sizeBytes: z.number(),
  }).optional(),
  error: z.string().optional(),
});

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc',
]);

const DISALLOWED_TAGS_RE = /<\s*\/?\s*(script|foreignObject|iframe|object|embed|audio|video|image|use)\b/i;

const SAFE_ATTRS = new Set([
  'id', 'class', 'xmlns', 'xmlns:xlink', 'version', 'viewBox', 'width', 'height', 'preserveAspectRatio',
  'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'clip-rule',
  'transform', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
  'mask', 'clip-path', 'aria-label', 'role',
]);

const ROOT_NUMERIC_ATTRS = ['width', 'height'] as const;

export class SvgSanitizationError extends Error {
  constructor(
    message: string,
    public readonly status: 413 | 422,
  ) {
    super(message);
  }
}

const safeNumber = (value?: string): number | undefined => {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/px$/i, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

export function sanitizeSvg(rawSvg: string, requestedMaxPaths = 300) {
  if (rawSvg.length > SVG_STUDIO_MAX_RAW_SIZE) {
    throw new SvgSanitizationError(`SVG exceeds ${SVG_STUDIO_MAX_RAW_SIZE} bytes`, 413);
  }

  if (DISALLOWED_TAGS_RE.test(rawSvg)) {
    throw new SvgSanitizationError('SVG contains disallowed tags', 422);
  }

  if (/on[a-z]+\s*=\s*/i.test(rawSvg)) {
    throw new SvgSanitizationError('Inline event handlers are not allowed in SVG', 422);
  }

  if (/(href|xlink:href)\s*=\s*['"]\s*(javascript:|data:text\/html|https?:|\/\/)/i.test(rawSvg)) {
    throw new SvgSanitizationError('Unsafe href/xlink:href detected in SVG', 422);
  }

  if (/<style[\s\S]*?(?:@import|url\s*\(\s*(?:https?:|\/\/))/i.test(rawSvg)) {
    throw new SvgSanitizationError('Unsafe style rules detected in SVG', 422);
  }

  let cleaned = rawSvg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  if (!/^<svg[\s\S]*<\/svg>$/i.test(cleaned)) {
    throw new SvgSanitizationError('Response is not a valid root <svg> document', 422);
  }

  let elementCount = 0;
  let pathCount = 0;
  const warnings: string[] = [];

  cleaned = cleaned.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/g, (match, tagNameRaw: string, attrsRaw: string) => {
    if (match.startsWith('</') || match.startsWith('<!')) {
      return match;
    }

    const selfClosing = /\/>\s*$/.test(match);
    const tagName = tagNameRaw;

    if (!ALLOWED_TAGS.has(tagName)) {
      throw new SvgSanitizationError(`Disallowed SVG element: <${tagName}>`, 422);
    }

    elementCount += 1;
    if (elementCount > SVG_STUDIO_MAX_ELEMENTS) {
      throw new SvgSanitizationError(`SVG exceeds max element count (${SVG_STUDIO_MAX_ELEMENTS})`, 422);
    }

    if (tagName === 'path') {
      pathCount += 1;
      if (pathCount > Math.min(requestedMaxPaths, SVG_STUDIO_MAX_PATHS)) {
        throw new SvgSanitizationError(`SVG exceeds max path count (${Math.min(requestedMaxPaths, SVG_STUDIO_MAX_PATHS)})`, 422);
      }
    }

    const sanitizedAttrs: string[] = [];
    const attrRe = /([:@\w-]+)\s*=\s*("[^"]*"|'[^']*')/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRe.exec(attrsRaw)) !== null) {
      const attrName = attrMatch[1];
      const attrValueQuoted = attrMatch[2];
      const attrValue = attrValueQuoted.slice(1, -1);

      if (!SAFE_ATTRS.has(attrName)) {
        continue;
      }

      if ((attrName === 'href' || attrName === 'xlink:href') && !attrValue.startsWith('#')) {
        throw new SvgSanitizationError('Only fragment href values are allowed in SVG', 422);
      }

      if (tagName === 'path' && attrName === 'd' && attrValue.length > SVG_STUDIO_MAX_PATH_COMMAND_LENGTH) {
        throw new SvgSanitizationError('A path command exceeds the maximum allowed length', 422);
      }

      sanitizedAttrs.push(`${attrName}=${attrValueQuoted}`);
    }

    return `<${tagName}${sanitizedAttrs.length > 0 ? ` ${sanitizedAttrs.join(' ')}` : ''}${selfClosing ? ' /' : ''}>`;
  });

  const rootTagMatch = cleaned.match(/^<svg\b([^>]*)>/i);
  if (!rootTagMatch) {
    throw new SvgSanitizationError('Missing root <svg> element', 422);
  }

  const rootAttrs = rootTagMatch[1];
  const attrs: Record<string, string> = {};
  for (const attr of ROOT_NUMERIC_ATTRS) {
    const m = rootAttrs.match(new RegExp(`${attr}\\s*=\\s*['"]([^'"]+)['"]`, 'i'));
    if (m?.[1]) attrs[attr] = m[1];
  }
  const vb = rootAttrs.match(/viewBox\s*=\s*['"]([^'"]+)['"]/i)?.[1];

  const width = safeNumber(attrs.width);
  const height = safeNumber(attrs.height);

  if (width && width > SVG_STUDIO_MAX_DIMENSION) {
    throw new SvgSanitizationError(`SVG width exceeds ${SVG_STUDIO_MAX_DIMENSION}`, 422);
  }
  if (height && height > SVG_STUDIO_MAX_DIMENSION) {
    throw new SvgSanitizationError(`SVG height exceeds ${SVG_STUDIO_MAX_DIMENSION}`, 422);
  }

  if (!/xmlns\s*=\s*['"]http:\/\/www\.w3\.org\/2000\/svg['"]/i.test(rootAttrs)) {
    warnings.push('Root SVG was missing xmlns and may not render consistently in all environments.');
  }

  return {
    svg: cleaned,
    metadata: {
      width,
      height,
      viewBox: vb,
      elementCount,
      pathCount,
      sanitized: true,
      warnings,
    },
  };
}

export const SVG_STUDIO_SYSTEM_PROMPT = `You are an expert SVG designer.
Return concise, production-ready SVG markup for animation pipelines.
Strict rules:
- Output SVG only.
- Use ONLY these tags: svg, g, path, rect, circle, ellipse, line, polyline, polygon, defs, linearGradient, radialGradient, stop, clipPath, mask, title, desc.
- Never use script, foreignObject, iframe, object, embed, audio, video, image, style, use.
- Never emit event handlers (onload/onerror/etc).
- Prefer simple shape composition and clear layering.
- Keep path count modest and avoid giant path data.
`;

export function buildSvgStudioPrompt(input: z.infer<typeof SvgStudioRequestSchema>) {
  const constraints = input.constraints;
  const lines: string[] = [
    `Action: ${input.action}`,
    `Prompt: ${input.prompt}`,
  ];

  if (constraints) {
    lines.push('Constraints:');
    if (constraints.width) lines.push(`- width=${constraints.width}`);
    if (constraints.height) lines.push(`- height=${constraints.height}`);
    if (constraints.viewBox) lines.push(`- viewBox=${constraints.viewBox}`);
    if (constraints.colorPalette?.length) lines.push(`- palette=${constraints.colorPalette.join(', ')}`);
    lines.push(`- maxPaths=${constraints.maxPaths ?? 300}`);
    lines.push(`- forAnimation=${constraints.forAnimation ?? true}`);
  }

  if (input.action === 'edit' && input.svg) {
    lines.push('Existing SVG (edit this while preserving intent):');
    lines.push(input.svg);
  }

  lines.push('Return JSON with fields: svg (string) and warnings (string[]).');
  return lines.join('\n');
}
