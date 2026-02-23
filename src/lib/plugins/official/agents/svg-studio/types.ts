export type SvgStudioPhase = 'idle' | 'working' | 'ready' | 'error';

export interface SvgStudioAsset {
  id: string;
  url: string;
  mimeType: 'image/svg+xml';
  sizeBytes: number;
}

export interface SvgStudioMetadata {
  width?: number;
  height?: number;
  viewBox?: string;
  elementCount: number;
  pathCount: number;
  sanitized: boolean;
  warnings: string[];
}

export interface SvgStudioState {
  phase: SvgStudioPhase;
  mode: 'generate' | 'edit';
  prompt: string;
  sourceSvg?: string;
  svg?: string;
  metadata?: SvgStudioMetadata;
  asset?: SvgStudioAsset;
  error?: string;
  updatedAt: string;
}

export interface SvgStudioNodeData extends Record<string, unknown> {
  name?: string;
  outputUrl?: string;
  outputMimeType?: string;
  outputType?: 'image';
  state: SvgStudioState;
}

export const createDefaultSvgStudioState = (): SvgStudioState => ({
  phase: 'idle',
  mode: 'generate',
  prompt: '',
  updatedAt: new Date().toISOString(),
});
