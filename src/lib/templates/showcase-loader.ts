/**
 * Dynamic Showcase Template Loader
 *
 * Loads showcase templates from JSON files in /public/templates/
 * These templates contain real generated assets and are read-only.
 */

import type { Template, TemplateMetadata, ShowcaseTag } from './types';
import { templateToMetadata } from './types';

// Cache for loaded templates
let showcaseTemplatesCache: Template[] | null = null;
let showcaseMetadataCache: TemplateMetadata[] | null = null;

/**
 * List of showcase template IDs to load
 * Add new template IDs here after creating them with the script
 */
const SHOWCASE_TEMPLATE_IDS = [
  'gemini-hackathon',
  'promo-advertising',
];

/**
 * Load a single showcase template from JSON
 */
async function loadShowcaseTemplate(templateId: string): Promise<Template | null> {
  try {
    const response = await fetch(`/templates/${templateId}.json`);
    if (!response.ok) {
      console.warn(`Template ${templateId} not found`);
      return null;
    }
    const template = await response.json();
    return template as Template;
  } catch (error) {
    console.warn(`Failed to load template ${templateId}:`, error);
    return null;
  }
}

/**
 * Load all showcase templates
 */
export async function loadShowcaseTemplates(): Promise<Template[]> {
  if (showcaseTemplatesCache) {
    return showcaseTemplatesCache;
  }

  const templates = await Promise.all(
    SHOWCASE_TEMPLATE_IDS.map(loadShowcaseTemplate)
  );

  showcaseTemplatesCache = templates.filter((t): t is Template => t !== null);
  return showcaseTemplatesCache;
}

/**
 * Get showcase template metadata (lighter weight for listing)
 */
export async function getShowcaseTemplateMetadata(): Promise<TemplateMetadata[]> {
  if (showcaseMetadataCache) {
    return showcaseMetadataCache;
  }

  const templates = await loadShowcaseTemplates();
  showcaseMetadataCache = templates.map(templateToMetadata);
  return showcaseMetadataCache;
}

/**
 * Get a single showcase template by ID
 */
export async function getShowcaseTemplate(templateId: string): Promise<Template | null> {
  // Check cache first
  if (showcaseTemplatesCache) {
    return showcaseTemplatesCache.find(t => t.id === templateId) || null;
  }

  // Load directly if not cached
  return loadShowcaseTemplate(templateId);
}

/**
 * Get showcase templates filtered by tag
 */
export async function getShowcaseTemplatesByTag(tag: ShowcaseTag): Promise<Template[]> {
  const templates = await loadShowcaseTemplates();
  return templates.filter(t => t.tags?.includes(tag));
}

/**
 * Get all tags currently in use by showcase templates
 */
export async function getShowcaseTagsInUse(): Promise<ShowcaseTag[]> {
  const templates = await loadShowcaseTemplates();
  const tags = new Set<ShowcaseTag>();
  templates.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
  return Array.from(tags);
}

/**
 * Clear the template cache (useful for development)
 */
export function clearShowcaseCache(): void {
  showcaseTemplatesCache = null;
  showcaseMetadataCache = null;
}

/**
 * Check if a template ID is a showcase template
 */
export function isShowcaseTemplateId(templateId: string): boolean {
  return SHOWCASE_TEMPLATE_IDS.includes(templateId);
}

/**
 * Add a new showcase template ID to the loader
 * (for dynamically registered templates)
 */
export function registerShowcaseTemplateId(templateId: string): void {
  if (!SHOWCASE_TEMPLATE_IDS.includes(templateId)) {
    SHOWCASE_TEMPLATE_IDS.push(templateId);
    // Clear cache so it will be reloaded
    showcaseTemplatesCache = null;
    showcaseMetadataCache = null;
  }
}
