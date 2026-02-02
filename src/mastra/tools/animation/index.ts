/**
 * Animation Tools
 *
 * All tools for the Animation Agent.
 */

// UI Communication Tools
export {
  updateTodoTool,
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

// Code Generation Tool (subagent-as-tool)
export { generateCodeTool } from './generate-code-tool';

// Sandbox Tools
export {
  sandboxCreateTool,
  sandboxDestroyTool,
  sandboxWriteFileTool,
  sandboxReadFileTool,
  sandboxRunCommandTool,
  sandboxListFilesTool,
  sandboxStartPreviewTool,
  sandboxScreenshotTool,
  renderPreviewTool,
  renderFinalTool,
} from './sandbox-tools';
