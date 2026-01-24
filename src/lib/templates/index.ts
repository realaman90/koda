export type { Template, TemplateCategory, TemplateMetadata, ShowcaseTag } from './types';
export { templateToMetadata } from './types';

// Showcase template loader (for JSON-based templates with real assets)
export {
  loadShowcaseTemplates,
  getShowcaseTemplateMetadata,
  getShowcaseTemplate,
  getShowcaseTemplatesByTag,
  getShowcaseTagsInUse,
  clearShowcaseCache,
  isShowcaseTemplateId,
  registerShowcaseTemplateId,
} from './showcase-loader';

import type { Template, TemplateMetadata, ShowcaseTag } from './types';
import { templateToMetadata } from './types';

// Import built-in templates
import { blankTemplate } from './built-in/blank';
import { imageWorkflowTemplate } from './built-in/image-workflow';
import { videoProductionTemplate } from './built-in/video-production';
import { storyboardTemplate } from './built-in/storyboard';
import { moodBoardTemplate } from './built-in/mood-board';
import { productVariationsTemplate } from './built-in/product-variations';
import { brandIdentityTemplate } from './built-in/brand-identity';
import { modelSwapTemplate } from './built-in/model-swap';

/**
 * All built-in templates
 */
export const builtInTemplates: Template[] = [
  blankTemplate,
  imageWorkflowTemplate,
  videoProductionTemplate,
  productVariationsTemplate,
  brandIdentityTemplate,
  storyboardTemplate,
  modelSwapTemplate,
  moodBoardTemplate,
];

/**
 * Get template metadata for listing
 */
export function getTemplateList(): TemplateMetadata[] {
  return builtInTemplates.map(templateToMetadata);
}

/**
 * Get a template by ID
 */
export function getTemplate(id: string): Template | null {
  return builtInTemplates.find((t) => t.id === id) || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: Template['category']): Template[] {
  return builtInTemplates.filter((t) => t.category === category);
}

/**
 * Get showcase templates (read-only templates with real generations)
 */
export function getShowcaseTemplates(): Template[] {
  return builtInTemplates.filter((t) => t.category === 'showcase' && t.readOnly);
}

/**
 * Get built-in showcase templates by tag
 */
export function getBuiltInShowcaseTemplatesByTag(tag: ShowcaseTag): Template[] {
  return builtInTemplates.filter(
    (t) => t.category === 'showcase' && t.tags?.includes(tag)
  );
}

/**
 * Get all unique showcase tags in use
 */
export function getShowcaseTags(): ShowcaseTag[] {
  const tags = new Set<ShowcaseTag>();
  builtInTemplates
    .filter((t) => t.category === 'showcase')
    .forEach((t) => t.tags?.forEach((tag) => tags.add(tag)));
  return Array.from(tags);
}
