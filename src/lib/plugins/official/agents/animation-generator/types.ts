/**
 * Animation Generator Plugin Types
 * 
 * Plugin-specific type definitions based on ANIMATION_PLUGIN.md Part 9.4
 */

// ============================================
// PHASE TYPES
// ============================================

export type AnimationPhase = 
  | 'idle' 
  | 'question' 
  | 'plan' 
  | 'executing' 
  | 'preview' 
  | 'complete' 
  | 'error';

// ============================================
// QUESTION PHASE TYPES
// ============================================

export interface AnimationStyleOption {
  id: string;
  label: string;
  description?: string;
}

export interface AnimationQuestion {
  text: string;
  options: AnimationStyleOption[];
  customInput?: boolean;
}

export interface FormField {
  id: string;
  type: 'text' | 'select' | 'multi_select';
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: AnimationStyleOption[];
  defaultValue?: string | string[];
}

export interface AnimationFormQuestion {
  content: string;
  fields: FormField[];
}

// ============================================
// PLAN PHASE TYPES
// ============================================

export interface AnimationScene {
  number: number;
  title: string;
  duration: number;
  description: string;
  animationNotes?: string;
}

export interface AnimationPlan {
  scenes: AnimationScene[];
  totalDuration: number;
  style: string;
  fps: number;
  designSpec?: string;
}

// ============================================
// EXECUTION PHASE TYPES
// ============================================

export interface AnimationTodo {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
}

export interface AnimationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  /** Monotonically increasing sequence number for stable chronological ordering */
  seq?: number;
  /** Snapshot of media attached when this message was sent */
  media?: MediaEntry[];
}

export interface ToolCallItem {
  id: string;
  toolCallId: string;
  toolName: string;
  displayName: string;
  status: 'running' | 'done' | 'failed';
  args?: Record<string, unknown>;  // Tool arguments for showing context
  output?: string;
  error?: string;
  timestamp: string;
  /** Monotonically increasing sequence number for stable chronological ordering */
  seq?: number;
}

export interface ThinkingBlockItem {
  id: string;
  label: string;
  reasoning?: string;
  startedAt: string;
  endedAt?: string;
  /** Monotonically increasing sequence number for stable chronological ordering */
  seq?: number;
}

/**
 * Active execution state (todos, thinking, streaming).
 * Conversation history (messages, toolCalls) lives on AnimationNodeState.
 */
export interface AnimationExecution {
  todos: AnimationTodo[];
  thinking: string;
  files: string[];
  /** Accumulated agent text output (streamed in real-time) */
  streamingText?: string;
  /** Accumulated extended thinking / reasoning from the model */
  reasoning?: string;
}

// ============================================
// VERSION TYPES (replaces preview phase)
// ============================================

export interface AnimationVersion {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  prompt: string;          // The prompt/feedback that generated this version
  createdAt: string;
}

// Legacy preview type (kept for compatibility during migration)
export interface AnimationPreview {
  videoUrl: string;
  streamUrl?: string;
  duration: number;
}

// ============================================
// OUTPUT TYPES
// ============================================

export interface AnimationOutput {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolution?: string;
  fileSize?: number;
}

// ============================================
// ERROR TYPES
// ============================================

export interface AnimationError {
  message: string;
  code: string;
  canRetry: boolean;
  details?: string;
}

// ============================================
// NODE STATE (from Spec 9.4)
// ============================================

export interface AnimationNodeState {
  // Core state
  nodeId: string;
  phase: AnimationPhase;

  // Conversation history (persists across phases)
  messages: AnimationMessage[];
  toolCalls: ToolCallItem[];
  thinkingBlocks: ThinkingBlockItem[];

  // Phase-specific data
  question?: AnimationQuestion;
  formQuestion?: AnimationFormQuestion;
  selectedStyle?: string;
  plan?: AnimationPlan;
  planTimestamp?: string;
  /** Sequence number for plan for stable chronological ordering */
  planSeq?: number;
  planAccepted?: boolean;
  execution?: AnimationExecution;
  preview?: AnimationPreview;
  previewTimestamp?: string;
  output?: AnimationOutput;
  error?: AnimationError;

  // Version history - each render creates a new version
  versions?: AnimationVersion[];
  /** Currently displayed version (defaults to latest) */
  activeVersionId?: string;

  // Sandbox state
  sandboxId?: string;
  sandboxStatus?: 'creating' | 'ready' | 'busy' | 'destroyed';
  lastCheckpoint?: string;

  // Live preview (deprecated - kept for compatibility)
  previewUrl?: string;
  previewUrlTimestamp?: string;
  previewState?: 'active' | 'stale' | 'hidden';

  // Timestamps
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================
// REFERENCE HANDLE TYPES
// ============================================

export interface AnimationAttachment {
  id: string;
  type: 'image' | 'video';
  url: string;
  name?: string;
  nodeId?: string;  // If referencing another node's output
}

/**
 * MediaEntry — tracks media files (images/videos) attached to the animation node.
 * Populated from edge connections or direct file uploads.
 * Stored in node.data.media[] and passed to the agent as context.
 */
export interface MediaEntry {
  id: string;
  source: 'upload' | 'edge';
  edgeId?: string;            // For edge-sourced media: the React Flow edge ID
  sourceNodeId?: string;      // For edge-sourced media: the source node ID
  name: string;
  type: 'image' | 'video';
  dataUrl: string;            // Blob URL, base64 data URL, or external URL
  description?: string;       // Short description (e.g. source node's generation prompt)
  duration?: number;          // Video only, in seconds
  thumbnailUrl?: string;      // For video previews (first frame)
  mimeType?: string;          // e.g. 'image/png', 'video/mp4'
}

// ============================================
// NODE DATA (for React Flow)
// ============================================

// Animation engine type
export type AnimationEngine = 'remotion' | 'theatre';

// Aspect ratio type
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export interface AnimationNodeData extends Record<string, unknown> {
  name?: string;
  prompt: string;
  state: AnimationNodeState;

  // Animation engine (Remotion or Theatre.js)
  engine?: AnimationEngine;

  // Aspect ratio (default 16:9)
  aspectRatio?: AspectRatio;

  // Target animation duration in seconds (default 10)
  duration?: number;

  // Dynamic handle counts
  imageRefCount?: number;  // Number of image reference handles (default 1)
  videoRefCount?: number;  // Number of video reference handles (default 1)

  // Technique presets (selective recipe injection into code gen context)
  techniques?: string[];

  // Design spec (style, colors, fonts) — from settings panel
  designSpec?: {
    style?: string;
    colors?: { primary: string; secondary: string; accent?: string };
    fonts?: { title: string; body: string };
  };

  // Output settings
  fps?: number;                              // 24 | 30 | 60
  resolution?: '720p' | '1080p' | '4k';

  // Attachments for chat input
  attachments?: AnimationAttachment[];

  // Media files (images/videos) from edge connections or direct uploads
  media?: MediaEntry[];
}

// ============================================
// API TYPES
// ============================================

export type AnimationAction =
  | 'analyze'
  | 'generatePlan'
  | 'revisePlan'
  | 'execute'
  | 'regenerate'
  | 'finalize'
  | 'cleanup';

export interface AnimationAPIRequest {
  nodeId: string;
  action: AnimationAction;
  prompt?: string;
  selectedStyle?: string;
  plan?: AnimationPlan;
  feedback?: string;
  currentPlan?: AnimationPlan;
  previewUrl?: string;
  sandboxId?: string;
  duration?: number;
  resolution?: '720p' | '1080p' | '4k';
}

export interface AnimationAPIResponse {
  success: boolean;
  needsClarification?: boolean;
  question?: AnimationQuestion;
  plan?: AnimationPlan;
  phase?: AnimationPhase;
  error?: string;
  outputUrl?: string;
  thumbnailUrl?: string;
}
