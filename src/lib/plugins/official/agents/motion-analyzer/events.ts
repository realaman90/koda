/**
 * Motion Analyzer Stream Event Types
 *
 * Shared types for SSE events between the stream API route
 * and the useMotionAnalyzerStream hook.
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
export type MotionAnalyzerStreamEvent =
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

/** Agent's thinking/status message changed */
export interface ThinkingAppEvent {
  kind: 'thinking';
  message: string;
}

/** Agent sent a chat message */
export interface MessageAppEvent {
  kind: 'message';
  content: string;
  messageId: string;
}

/** Video analysis completed */
export interface AnalysisCompleteAppEvent {
  kind: 'analysis_complete';
  analysis: Record<string, unknown>;
}

/** Animation prompt generated */
export interface PromptGeneratedAppEvent {
  kind: 'prompt_generated';
  prompt: string;
  focusArea?: string;
}

/** Union of all application-level events */
export type MotionAnalyzerAppEvent =
  | ThinkingAppEvent
  | MessageAppEvent
  | AnalysisCompleteAppEvent
  | PromptGeneratedAppEvent;

// ============================================
// TOOL NAME CONSTANTS
// ============================================

export const UI_TOOL_NAMES = [
  'set_thinking',
  'add_message',
] as const;

export const ANALYSIS_TOOL_NAMES = [
  'analyze_video_motion',
] as const;

export const PROMPT_TOOL_NAMES = [
  'generate_animation_prompt',
] as const;

export type UIToolName = typeof UI_TOOL_NAMES[number];
export type AnalysisToolName = typeof ANALYSIS_TOOL_NAMES[number];
export type PromptToolName = typeof PROMPT_TOOL_NAMES[number];
export type MotionAnalyzerToolName = UIToolName | AnalysisToolName | PromptToolName;

/** Tool display names for the UI */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  set_thinking: 'Thinking',
  add_message: 'Message',
  analyze_video_motion: 'Analyzing Video',
  generate_animation_prompt: 'Generating Prompt',
  analyze_media: 'Analyzing Media',
};

/**
 * Map a tool-call event to an application-level event.
 */
export function toolCallToAppEvent(toolName: string, args: Record<string, unknown>): MotionAnalyzerAppEvent | null {
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
export function toolResultToAppEvent(toolName: string, result: Record<string, unknown>): MotionAnalyzerAppEvent | null {
  if (result.success === false) return null;

  switch (toolName) {
    case 'analyze_video_motion':
      return {
        kind: 'analysis_complete',
        analysis: result,
      };
    case 'generate_animation_prompt':
      return {
        kind: 'prompt_generated',
        prompt: result.prompt as string,
        focusArea: result.focusArea as string | undefined,
      };
    default:
      return null;
  }
}
