/**
 * Plugin System Types
 *
 * This file contains all type definitions for the Agent Plugin system.
 * These types are designed to be provider-agnostic - plugins define their
 * own schemas and prompts, while the AIService handles execution.
 */

import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { AppNode, AppEdge } from '@/lib/types';

// ============================================
// PLUGIN BASE TYPES
// ============================================

/**
 * Plugin categories for organization and filtering
 */
export type PluginCategory =
  | 'planning'      // Pre-production, storyboards, scripts
  | 'brand'         // Brand extraction, consistency
  | 'adaptation'    // Resizing, format conversion
  | 'analysis'      // Image understanding, reverse prompts
  | 'text'          // Captions, copy generation
  | 'enhancement'   // Upscaling, background removal
  | 'automation'    // Batch processing, templates
  | 'export';       // Publishing, integrations

/**
 * Plugin author information
 */
export interface PluginAuthor {
  type: 'official' | 'community' | 'user';
  id?: string;
  name: string;
  verified?: boolean;
}

/**
 * Base plugin interface - shared by all plugin types
 */
export interface PluginBase {
  id: string;
  name: string;
  description: string;
  icon: string;  // Emoji or icon identifier
  category: PluginCategory;
  author: PluginAuthor;
  version: string;
  visibility: 'private' | 'team' | 'public';
}

// ============================================
// AGENT PLUGIN TYPES
// ============================================

/**
 * What an Agent Plugin can do on the canvas
 * Note: 'canvas:group' is deferred for future implementation
 */
export type AgentCapability =
  | 'canvas:read'     // Read existing nodes
  | 'canvas:create'   // Create new nodes
  | 'canvas:connect'  // Create edges between nodes
  | 'canvas:modify';  // Modify existing nodes

/**
 * Services available to Agent Plugins
 */
export type AgentService =
  | 'ai'        // LLM/AI generation
  | 'storage';  // File storage (future)

/**
 * Sandbox modal size variants
 */
export type SandboxSize = 'small' | 'medium' | 'large' | 'fullscreen';

/**
 * Props passed to sandbox components
 */
export interface AgentSandboxProps {
  canvas: CanvasAPI;
  onClose: () => void;
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Agent Plugin - Interactive plugins that create nodes via a sandbox UI
 */
export interface AgentPlugin extends PluginBase {
  type: 'agent';
  sandbox: {
    component: ComponentType<AgentSandboxProps>;
    size: SandboxSize;
    title: string;
  };
  capabilities: AgentCapability[];
  services: AgentService[];
}

// ============================================
// CANVAS API TYPES
// ============================================

/**
 * Node type identifiers for creation
 */
export type CreateNodeType = 'text' | 'media' | 'imageGenerator' | 'videoGenerator';

/**
 * Input for creating a new node
 */
export interface CreateNodeInput {
  type: CreateNodeType;
  position?: { x: number; y: number };
  data: Record<string, unknown>;
  name?: string;  // For imageGenerator/videoGenerator nodes
}

/**
 * Canvas API - Safe interface for plugins to interact with the canvas
 * This is what plugins receive to manipulate the canvas
 */
export interface CanvasAPI {
  // Read operations
  getNodes(): AppNode[];
  getSelectedNodes(): AppNode[];
  getEdges(): AppEdge[];

  // Create operations
  createNode(input: CreateNodeInput): Promise<string>;  // Returns node ID
  createNodes(inputs: CreateNodeInput[]): Promise<string[]>;  // Returns node IDs
  createEdge(
    fromId: string,
    fromHandle: string,
    toId: string,
    toHandle: string
  ): Promise<string>;  // Returns edge ID

  // Position helpers
  getViewportCenter(): { x: number; y: number };
  getGridPosition(
    index: number,
    columns?: number,
    spacing?: number,
    startPosition?: { x: number; y: number }
  ): { x: number; y: number };

  // View controls
  focusNode(nodeId: string): void;
  fitView(nodeIds?: string[]): void;
}

// ============================================
// AI SERVICE TYPES (Provider-Agnostic)
// ============================================

/**
 * Options for AI service calls
 * These options work across all providers (Mastra, Vercel AI SDK, direct APIs)
 */
export interface AIServiceOptions {
  systemPrompt?: string;   // Instructions for the LLM
  model?: string;          // Model override (e.g., 'anthropic/claude-sonnet-4-20250514')
  temperature?: number;    // 0-1, controls randomness
}

/**
 * AI Service Interface - Provider-agnostic LLM interaction
 *
 * Plugins use this interface to get structured output from an LLM.
 * The underlying implementation can be swapped without changing plugin code.
 *
 * Current implementation: Mastra LLM
 * Future options: Vercel AI SDK, Direct Anthropic/OpenAI API, etc.
 */
export interface AIService {
  generateStructured<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: AIServiceOptions
  ): Promise<z.infer<T>>;
}

// ============================================
// PLUGIN REGISTRY TYPES
// ============================================

/**
 * Plugin registry interface for managing plugins
 */
export interface PluginRegistry {
  register(plugin: AgentPlugin): void;
  get(id: string): AgentPlugin | undefined;
  getAll(): AgentPlugin[];
  getByCategory(category: PluginCategory): AgentPlugin[];
}
