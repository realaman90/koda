/**
 * Motion Analyzer Plugin Types
 *
 * Simple chat-based plugin for analyzing video motion design
 * and generating animation prompts. No sandbox, no plan approval.
 */

// ============================================
// PHASE TYPES
// ============================================

export type MotionAnalyzerPhase =
  | 'idle'
  | 'analyzing'
  | 'chatting'
  | 'complete'
  | 'error';

// ============================================
// ANALYSIS TYPES
// ============================================

/** A single motion effect detected in the video */
export interface MotionEffect {
  name: string;
  category: 'camera' | 'transition' | 'animation' | 'typography' | 'compositing' | 'timing' | 'color' | '3d';
  timestamp?: number;
  duration?: number;
  description: string;
  parameters?: string; // e.g. "spring(200, 0.6)", "ease-in-out 0.4s"
}

/** A scene segment from the video */
export interface AnalysisScene {
  number: number;
  startTime: number;
  endTime: number;
  description: string;
  cameraMovement?: string;
  effects: MotionEffect[];
  mood?: string;
  colors?: string[];
}

/** Full motion analysis result */
export interface MotionAnalysis {
  summary: string;
  duration: number;
  scenes: AnalysisScene[];
  effects: MotionEffect[];
  cameraMovements: string[];
  transitions: string[];
  pacing: string;
  overallStyle: string;
}

/** Generated animation prompt */
export interface GeneratedPrompt {
  id: string;
  prompt: string;
  focusArea?: string;
  createdAt: string;
}

// ============================================
// MESSAGE TYPES
// ============================================

export interface MotionAnalyzerMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  seq?: number;
  /** Video attached to this message */
  videoUrl?: string;
  videoName?: string;
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

export interface MotionAnalyzerNodeState {
  nodeId: string;
  phase: MotionAnalyzerPhase;

  // Conversation history
  messages: MotionAnalyzerMessage[];
  toolCalls: ToolCallItem[];
  thinkingBlocks: ThinkingBlockItem[];

  // Analysis results
  analysis?: MotionAnalysis;

  // Generated prompts (can accumulate through conversation)
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
// VIDEO INPUT TYPES
// ============================================

export interface VideoInput {
  id: string;
  source: 'upload' | 'youtube';
  name: string;
  dataUrl: string; // base64 data URL for uploads
  youtubeUrl?: string; // original YouTube URL
  mimeType?: string;
  duration?: number;
  thumbnailUrl?: string;
  /** User-selected trim range (for videos > 20s) */
  trimStart?: number;
  trimEnd?: number;
}

// ============================================
// NODE DATA (for React Flow)
// ============================================

export interface MotionAnalyzerNodeData extends Record<string, unknown> {
  name?: string;
  state: MotionAnalyzerNodeState;

  // Current video being analyzed
  video?: VideoInput;
}

// ============================================
// API TYPES
// ============================================

export interface MotionAnalyzerStreamRequest {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    nodeId?: string;
    phase?: string;
    video?: VideoInput;
  };
}
