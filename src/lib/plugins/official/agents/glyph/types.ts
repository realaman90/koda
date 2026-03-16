export type GlyphPhase =
  | 'idle'
  | 'generating'
  | 'drafting'
  | 'finalizing'
  | 'ready'
  | 'error';

export type GlyphModel =
  | 'vecglypher'
  | 'vecglypher-image-to-svg';

export interface GlyphAsset {
  id: string;
  url: string;
  mimeType: 'image/svg+xml';
  sizeBytes: number;
}

export interface GlyphMetadata {
  width?: number;
  height?: number;
  viewBox?: string;
  elementCount: number;
  pathCount: number;
  sanitized: boolean;
  warnings: string[];
}

export interface GlyphSettings {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  outputSize: number;
  temperature: number;
  seed?: number;
  maxTokens: number;
}

export const DEFAULT_GLYPH_SETTINGS: GlyphSettings = {
  fillColor: 'black',
  strokeColor: '',
  strokeWidth: 1,
  outputSize: 512,
  temperature: 0.1,
  seed: undefined,
  maxTokens: 8192,
};

export interface GlyphState {
  phase: GlyphPhase;
  model: GlyphModel;
  prompt: string;
  settings: GlyphSettings;
  svg?: string;
  partialSvg?: string;
  metadata?: GlyphMetadata;
  asset?: GlyphAsset;
  error?: string;
  updatedAt: string;
}

export interface GlyphNodeData extends Record<string, unknown> {
  name?: string;
  outputUrl?: string;
  outputMimeType?: string;
  outputType?: 'image';
  state: GlyphState;
}

export const createDefaultGlyphState = (): GlyphState => ({
  phase: 'idle',
  model: 'vecglypher',
  prompt: '',
  settings: { ...DEFAULT_GLYPH_SETTINGS },
  updatedAt: new Date().toISOString(),
});
