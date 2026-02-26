/**
 * Prompt Studio Plugin Types
 *
 * Chat-based creative director plugin for generating
 * production-quality prompts for image/video models.
 */

// ============================================
// PHASE TYPES
// ============================================

export type PromptStudioPhase =
  | 'idle'
  | 'generating'
  | 'chatting'
  | 'complete'
  | 'error';

// ============================================
// GENERATED PROMPT TYPES
// ============================================

export interface GeneratedPrompt {
  id: string;
  prompt: string;
  targetModel: string;
  label?: string;
  negativePrompt?: string;
  parameters?: Record<string, string>;
  createdAt: string;
}

// ============================================
// MESSAGE TYPES
// ============================================

export interface PromptStudioMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  seq?: number;
}

export interface ToolCallItem {
  id: string;
  toolCallId: string;
  toolName: string;
  displayName: string;
  status: 'running' | 'done' | 'failed';
  args?: Record<string, unknown>;
  output?: string;
  error?: string;
  timestamp: string;
  seq?: number;
}

export interface ThinkingBlockItem {
  id: string;
  label: string;
  reasoning?: string;
  startedAt: string;
  endedAt?: string;
  seq?: number;
}

// ============================================
// NODE STATE
// ============================================

export interface PromptStudioNodeState {
  nodeId: string;
  phase: PromptStudioPhase;

  // Conversation history
  messages: PromptStudioMessage[];
  toolCalls: ToolCallItem[];
  thinkingBlocks: ThinkingBlockItem[];

  // Generated prompts (accumulate through conversation)
  generatedPrompts: GeneratedPrompt[];

  // Current streaming state
  streamingText?: string;
  reasoning?: string;

  // Error state
  error?: { message: string; canRetry: boolean };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// NODE DATA (for React Flow)
// ============================================

export interface PromptStudioNodeData extends Record<string, unknown> {
  name?: string;
  state: PromptStudioNodeState;
}

// ============================================
// API TYPES
// ============================================

export interface PromptStudioStreamRequest {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    nodeId?: string;
    phase?: string;
  };
}
