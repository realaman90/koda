/**
 * Prompt Studio Stream Event Types
 *
 * Shared types for SSE events between the stream API route
 * and the usePromptStudioStream hook.
 */

// ============================================
// RAW SSE EVENT TYPES (from Mastra stream)
// ============================================

export interface TextDeltaEvent {
  type: 'text-delta';
  text: string;
}

export interface ToolCallEvent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: Record<string, unknown>;
  isError?: boolean;
}

export interface StepFinishEvent {
  type: 'step-finish';
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface FinishEvent {
  type: 'finish';
  finishReason?: string;
}

export interface CompleteEvent {
  type: 'complete';
  text: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface ReasoningDeltaEvent {
  type: 'reasoning-delta';
  text: string;
}

/** Union of all SSE event types */
export type PromptStudioStreamEvent =
  | TextDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | StepFinishEvent
  | FinishEvent
  | CompleteEvent
  | ErrorEvent
  | ReasoningDeltaEvent;

// ============================================
// APPLICATION-LEVEL EVENT TYPES
// ============================================

export interface ThinkingAppEvent {
  kind: 'thinking';
  message: string;
}

export interface PromptGeneratedAppEvent {
  kind: 'prompt_generated';
  promptId: string;
  prompt: string;
  targetModel: string;
  label?: string;
  negativePrompt?: string;
  parameters?: Record<string, string>;
}

export type PromptStudioAppEvent =
  | ThinkingAppEvent
  | PromptGeneratedAppEvent;

// ============================================
// TOOL NAME CONSTANTS
// ============================================

export const UI_TOOL_NAMES = [
  'set_thinking',
] as const;

export const PROMPT_TOOL_NAMES = [
  'generate_prompt',
] as const;

export type UIToolName = typeof UI_TOOL_NAMES[number];
export type PromptToolName = typeof PROMPT_TOOL_NAMES[number];
export type PromptStudioToolName = UIToolName | PromptToolName;

/** Tool display names for the UI */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  set_thinking: 'Thinking',
  generate_prompt: 'Crafting Prompt',
};

/**
 * Map a tool-call event to an application-level event.
 */
export function toolCallToAppEvent(toolName: string, args: Record<string, unknown>): PromptStudioAppEvent | null {
  switch (toolName) {
    case 'set_thinking':
      return {
        kind: 'thinking',
        message: args.message as string,
      };
    default:
      return null;
  }
}

/**
 * Map a tool-result event to an application-level event.
 */
export function toolResultToAppEvent(toolName: string, args: Record<string, unknown>, result: Record<string, unknown>): PromptStudioAppEvent | null {
  if (result.success === false) return null;

  switch (toolName) {
    case 'generate_prompt':
      return {
        kind: 'prompt_generated',
        promptId: result.promptId as string,
        prompt: args.prompt as string,
        targetModel: args.targetModel as string,
        label: args.label as string | undefined,
        negativePrompt: args.negativePrompt as string | undefined,
        parameters: args.parameters as Record<string, string> | undefined,
      };
    default:
      return null;
  }
}
