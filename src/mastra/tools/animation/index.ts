/**
 * Animation Tools
 *
 * All tools for the Animation Agent.
 */

// UI Communication Tools
export {
  updateTodoTool,
  batchUpdateTodosTool,
  setThinkingTool,
  addMessageTool,
  requestApprovalTool,
} from './ui-tools';

// Planning Tools
export {
  analyzePromptTool,
  generatePlanTool,
  generateTodosFromPlan,
  DEFAULT_STYLE_QUESTION,
  StyleOptionSchema,
  QuestionSchema,
  SceneSchema,
  PlanSchema,
  TodoSchema,
} from './planning-tools';

// Code Generation Tools (subagent-as-tool)
export { generateCodeTool } from './generate-code-tool';
export { generateRemotionCodeTool } from './generate-remotion-code-tool';

// Documentation Tool (self-healing)
export { fetchDocsTool } from './fetch-docs-tool';

// Prompt Enhancement Tool
export { enhanceAnimationPromptTool } from './enhance-prompt-tool';

// Media Analysis Tool
export { analyzeMediaTool, SceneAnalysisSchema, MediaAnalysisResultSchema } from './analyze-media-tool';

// Video Verification Tool (subagent-as-tool)
export { verifyAnimationTool } from './verify-animation-tool';

// Sandbox Tools
export {
  sandboxCreateTool,
  sandboxDestroyTool,
  sandboxWriteFileTool,
  sandboxReadFileTool,
  sandboxRunCommandTool,
  sandboxListFilesTool,
  sandboxUploadMediaTool,
  sandboxWriteBinaryTool,
  extractVideoFramesTool,
  sandboxScreenshotTool,
  renderFinalTool,
} from './sandbox-tools';
