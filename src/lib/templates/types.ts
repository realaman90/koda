import type { AppNode, AppEdge } from '@/lib/types';

/**
 * Template category for organization
 */
export type TemplateCategory = 'starter' | 'workflow' | 'creative' | 'showcase';

/**
 * Showcase template tags for filtering
 */
export type ShowcaseTag =
  | 'featured'
  | 'kling'
  | 'nano-banana'
  | 'ai-partners'
  | 'branded'
  | 'branding'
  | 'photography'
  | 'social-media'
  | 'advertising'
  | 'making-of';

/**
 * Template definition
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;      // Path to preview image or emoji
  category: TemplateCategory;
  nodes: AppNode[];       // Pre-configured nodes
  edges: AppEdge[];       // Pre-configured connections
  readOnly?: boolean;     // If true, users cannot modify (showcase templates)
  tags?: ShowcaseTag[];   // Tags for filtering showcase templates
}

/**
 * Template metadata (for listing without full node/edge data)
 */
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: TemplateCategory;
  readOnly?: boolean;
  tags?: ShowcaseTag[];
}

/**
 * Convert template to metadata (for listing)
 */
export function templateToMetadata(template: Template): TemplateMetadata {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    thumbnail: template.thumbnail,
    category: template.category,
    readOnly: template.readOnly,
    tags: template.tags,
  };
}
