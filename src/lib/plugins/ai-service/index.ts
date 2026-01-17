/**
 * AI Service Export
 *
 * This file exports the default AI service provider.
 * To swap providers, simply change the import here.
 *
 * Current: Mastra Agent-based provider
 *
 * Future provider options (not implemented):
 * - VercelAIService - Uses generateObject() from AI SDK directly
 * - AnthropicDirectService - Uses @anthropic-ai/sdk with tool_use
 * - OpenAIDirectService - Uses response_format with JSON schema
 */

export { MastraAIService as AIService } from './mastra-provider';
export type { AIService as AIServiceInterface, AIServiceOptions } from './types';
