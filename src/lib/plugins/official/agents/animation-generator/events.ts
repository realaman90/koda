/**
 * Animation Stream Event Types
 *
 * Shared types for SSE events flowing from the animation stream API route
 * to the frontend useAnimationStream hook. These define the contract
 * between server and client.
 *
 * Based on ANIMATION_PLUGIN.md Part 6.3 — Event System
 */

// ============================================
// RAW SSE EVENT TYPES (from Mastra stream)
// ============================================

/** Text chunk from the agent */
export interface TextDeltaEvent {
  type: 'text-delta';
  text: string;
}

/** Agent is calling a tool */
export interface ToolCallEvent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/** Tool returned a result */
export interface ToolResultEvent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: Record<string, unknown>;
  isError?: boolean;
}

/** Agent step completed */
export interface StepFinishEvent {
  type: 'step-finish';
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/** Agent finished generating */
export interface FinishEvent {
  type: 'finish';
  finishReason?: string;
}

/** Stream fully complete with aggregated data */
export interface CompleteEvent {
  type: 'complete';
  text: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
}

/** Error occurred */
export interface ErrorEvent {
  type: 'error';
  error: string;
}

/** Extended thinking / reasoning from the model */
export interface ReasoningDeltaEvent {
  type: 'reasoning-delta';
  text: string;
}

/** Union of all SSE event types */
export type AnimationStreamEvent =
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
// Derived from tool calls — the frontend maps
// tool-call/tool-result events to these.
// ============================================

/** Todo status was updated by the agent */
export interface TodoUpdateAppEvent {
  kind: 'todo_update';
  todoId: string;
  status: 'pending' | 'active' | 'done';
}

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

/** Agent requested user approval */
export interface ApprovalRequestedAppEvent {
  kind: 'approval_requested';
  approvalType: 'question' | 'plan' | 'preview';
  content: string;
  options?: Array<{ id: string; label: string; description?: string }>;
}

/** Agent analyzed the prompt */
export interface PromptAnalyzedAppEvent {
  kind: 'prompt_analyzed';
  needsClarification: boolean;
  reason: string;
  question?: {
    text: string;
    options: Array<{ id: string; label: string; description?: string }>;
    customInput?: boolean;
  };
  inferredStyle?: string;
}

/** Agent generated a plan */
export interface PlanGeneratedAppEvent {
  kind: 'plan_generated';
  plan: {
    scenes: Array<{
      number: number;
      title: string;
      duration: number;
      description: string;
      animationNotes?: string;
    }>;
    totalDuration: number;
    style: string;
    fps: number;
  };
  todos: Array<{ id: string; label: string; status: 'pending' | 'active' | 'done' }>;
}

/** Agent wrote a file to the sandbox */
export interface FileWrittenAppEvent {
  kind: 'file_written';
  path: string;
}

/** Live preview is ready */
export interface PreviewReadyAppEvent {
  kind: 'preview_ready';
  previewUrl: string;
}

/** Screenshot(s) captured — supports batch mode */
export interface ScreenshotCapturedAppEvent {
  kind: 'screenshot_captured';
  screenshots: Array<{ imageUrl: string; timestamp: number }>;
}

/** Render completed (preview or final) */
export interface RenderCompleteAppEvent {
  kind: 'render_complete';
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolution?: string;
  quality: 'preview' | 'final';
}

/** Sandbox created */
export interface SandboxCreatedAppEvent {
  kind: 'sandbox_created';
  sandboxId: string;
  previewUrl: string;
}

/** Union of all application-level events */
export type AnimationAppEvent =
  | TodoUpdateAppEvent
  | ThinkingAppEvent
  | MessageAppEvent
  | ApprovalRequestedAppEvent
  | PromptAnalyzedAppEvent
  | PlanGeneratedAppEvent
  | FileWrittenAppEvent
  | PreviewReadyAppEvent
  | ScreenshotCapturedAppEvent
  | RenderCompleteAppEvent
  | SandboxCreatedAppEvent;

// ============================================
// TOOL NAME CONSTANTS
// Maps tool names to their event kinds for
// quick lookup in the SSE parser.
// ============================================

/** UI tools — tool-call args are used directly */
export const UI_TOOL_NAMES = [
  'update_todo',
  'set_thinking',
  'add_message',
  'request_approval',
] as const;

/** Planning tools — tool-result is used */
export const PLANNING_TOOL_NAMES = [
  'analyze_prompt',
  'generate_plan',
] as const;

/** Sandbox tools — tool-result is used for tracking */
export const SANDBOX_TOOL_NAMES = [
  'sandbox_create',
  'sandbox_destroy',
  'sandbox_write_file',
  'sandbox_read_file',
  'sandbox_run_command',
  'sandbox_list_files',
  'sandbox_start_preview',
  'sandbox_screenshot',
] as const;

/** Rendering tools — tool-result is used */
export const RENDER_TOOL_NAMES = [
  'render_preview',
  'render_final',
] as const;

export type UIToolName = typeof UI_TOOL_NAMES[number];
export type PlanningToolName = typeof PLANNING_TOOL_NAMES[number];
export type SandboxToolName = typeof SANDBOX_TOOL_NAMES[number];
export type RenderToolName = typeof RENDER_TOOL_NAMES[number];
export type AnimationToolName = UIToolName | PlanningToolName | SandboxToolName | RenderToolName;

/**
 * Map a tool-call event to an application-level event.
 * Returns null if the tool call doesn't produce an immediate app event
 * (e.g., sandbox_read_file doesn't need to update the UI on call).
 */
export function toolCallToAppEvent(toolName: string, args: Record<string, unknown>): AnimationAppEvent | null {
  switch (toolName) {
    case 'update_todo':
      return {
        kind: 'todo_update',
        todoId: args.todoId as string,
        status: args.status as 'pending' | 'active' | 'done',
      };
    case 'set_thinking':
      return {
        kind: 'thinking',
        message: args.message as string,
      };
    case 'request_approval':
      return {
        kind: 'approval_requested',
        approvalType: args.type as 'question' | 'plan' | 'preview',
        content: args.content as string,
        options: args.options as Array<{ id: string; label: string; description?: string }> | undefined,
      };
    default:
      return null;
  }
}

/**
 * Map a tool-result event to an application-level event.
 * Returns null if the result doesn't produce an app event.
 */
export function toolResultToAppEvent(toolName: string, result: Record<string, unknown>): AnimationAppEvent | null {
  if (result.success === false) return null;

  switch (toolName) {
    case 'add_message':
      return null; // message content is in the tool-call args, not result
    case 'analyze_prompt':
      return {
        kind: 'prompt_analyzed',
        needsClarification: result.needsClarification as boolean,
        reason: result.reason as string,
        question: result.question as PromptAnalyzedAppEvent['question'],
        inferredStyle: result.inferredStyle as string | undefined,
      };
    case 'generate_plan':
      return {
        kind: 'plan_generated',
        plan: result.plan as PlanGeneratedAppEvent['plan'],
        todos: result.todos as PlanGeneratedAppEvent['todos'],
      };
    case 'sandbox_create':
      return {
        kind: 'sandbox_created',
        sandboxId: result.sandboxId as string,
        previewUrl: result.previewUrl as string,
      };
    case 'sandbox_write_file':
      return {
        kind: 'file_written',
        path: result.path as string,
      };
    case 'sandbox_start_preview':
      return {
        kind: 'preview_ready',
        previewUrl: result.previewUrl as string,
      };
    case 'sandbox_screenshot':
      return {
        kind: 'screenshot_captured',
        screenshots: (result.screenshots as Array<{ imageUrl: string; timestamp: number }>) || [],
      };
    case 'render_preview':
      return {
        kind: 'render_complete',
        videoUrl: result.videoUrl as string,
        thumbnailUrl: result.thumbnailUrl as string,
        duration: result.duration as number,
        quality: 'preview',
      };
    case 'render_final':
      return {
        kind: 'render_complete',
        videoUrl: result.videoUrl as string,
        thumbnailUrl: result.thumbnailUrl as string,
        duration: result.duration as number,
        resolution: result.resolution as string | undefined,
        quality: 'final',
      };
    default:
      return null;
  }
}
