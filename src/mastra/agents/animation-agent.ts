/**
 * Animation Agent
 *
 * Mastra agent for creating animations from natural language.
 * Supports both Theatre.js (3D) and Remotion (2D) frameworks.
 * Uses tools for UI updates, planning, and sandbox operations.
 */

import { Agent } from '@mastra/core/agent';
import { ANIMATION_AGENT_INSTRUCTIONS } from './instructions/animation';
import {
  // UI Tools
  updateTodoTool,
  setThinkingTool,
  addMessageTool,
  requestApprovalTool,
  // Planning Tools
  analyzePromptTool,
  generatePlanTool,
  // Code Generation (subagent-as-tool)
  generateCodeTool,
  generateRemotionCodeTool,
  // Documentation (self-healing)
  fetchDocsTool,
  // Prompt Enhancement
  enhanceAnimationPromptTool,
  // Media Analysis
  analyzeMediaTool,
  // Sandbox Tools
  sandboxCreateTool,
  sandboxDestroyTool,
  sandboxWriteFileTool,
  sandboxReadFileTool,
  sandboxRunCommandTool,
  sandboxListFilesTool,
  sandboxUploadMediaTool,
  sandboxStartPreviewTool,
  sandboxScreenshotTool,
  renderPreviewTool,
  renderFinalTool,
} from '../tools/animation';

/**
 * Animation Agent
 *
 * Multi-phase agent for animation generation:
 * 1. Analyze → decide if clarification needed
 * 2. Plan → create scene breakdown
 * 3. Execute → create sandbox, write code
 * 4. Render → generate preview video
 */
export const animationAgent = new Agent({
  id: 'animation-agent',
  name: 'animation-agent',
  instructions: ANIMATION_AGENT_INSTRUCTIONS,
  model: 'anthropic/claude-opus-4-5',
  tools: {
    // UI Tools
    update_todo: updateTodoTool,
    set_thinking: setThinkingTool,
    add_message: addMessageTool,
    request_approval: requestApprovalTool,
    // Planning Tools
    analyze_prompt: analyzePromptTool,
    generate_plan: generatePlanTool,
    // Code Generation (subagent-as-tool)
    generate_code: generateCodeTool,              // Theatre.js (3D)
    generate_remotion_code: generateRemotionCodeTool,  // Remotion (2D)
    // Documentation (self-healing)
    fetch_docs: fetchDocsTool,
    // Prompt Enhancement
    enhance_animation_prompt: enhanceAnimationPromptTool,
    // Media Analysis
    analyze_media: analyzeMediaTool,
    // Sandbox Lifecycle
    sandbox_create: sandboxCreateTool,
    sandbox_destroy: sandboxDestroyTool,
    // Sandbox Operations
    sandbox_write_file: sandboxWriteFileTool,
    sandbox_read_file: sandboxReadFileTool,
    sandbox_run_command: sandboxRunCommandTool,
    sandbox_list_files: sandboxListFilesTool,
    sandbox_upload_media: sandboxUploadMediaTool,
    // Preview & Visual
    sandbox_start_preview: sandboxStartPreviewTool,
    sandbox_screenshot: sandboxScreenshotTool,
    // Rendering
    render_preview: renderPreviewTool,
    render_final: renderFinalTool,
  },
});
