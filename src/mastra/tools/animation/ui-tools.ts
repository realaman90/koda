/**
 * Animation UI Tools
 * 
 * Tools for updating the frontend UI (todos, thinking, messages).
 * These are intercepted by the streaming handler to update the node.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * update_todo - Update the status of a todo item
 */
export const updateTodoTool = createTool({
  id: 'update_todo',
  description: 'Update the status of a todo item in the UI. Call this when starting or completing a task.',
  inputSchema: z.object({
    todoId: z.string().describe('ID of the todo item (e.g., "setup", "scene-1", "render")'),
    status: z.enum(['pending', 'active', 'done']).describe('New status'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    todoId: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      success: true,
      todoId: context.todoId,
      status: context.status,
    };
  },
});

/**
 * set_thinking - Update the thinking/status message
 */
export const setThinkingTool = createTool({
  id: 'set_thinking',
  description: 'Set the thinking/status message shown to the user. Use this to explain what you are doing.',
  inputSchema: z.object({
    message: z.string().describe('Thinking message (e.g., "Writing animation keyframes...")'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async () => {
    return { success: true };
  },
});

/**
 * add_message - Add a message to the chat
 */
export const addMessageTool = createTool({
  id: 'add_message',
  description: 'Add a message to the chat interface. Use for important updates or questions.',
  inputSchema: z.object({
    content: z.string().describe('Message content'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      messageId: `msg_${Date.now()}`,
    };
  },
});

/**
 * request_approval - Request user approval for a question, plan, or preview
 *
 * This tool is intercepted by the SSE streaming handler on the frontend.
 * When the agent calls this, execution effectively pauses — the frontend
 * shows the approval UI and the user's response triggers a new stream call.
 */
export const requestApprovalTool = createTool({
  id: 'request_approval',
  description: `Request user approval before proceeding. Use this to:
- Ask a clarifying question (type: "question") with selectable options
- Present a plan for approval (type: "plan") before execution
- Ask for feedback on a preview (type: "preview") before finalizing

The frontend will show the appropriate UI and pause until the user responds.`,
  inputSchema: z.object({
    type: z.enum(['question', 'plan', 'preview']).describe('Type of approval requested'),
    content: z.string().describe('The question, plan summary, or message to show'),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })).optional().describe('Selectable options (for question type)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    type: z.string(),
    content: z.string(),
  }),
  execute: async ({ context }) => {
    // The tool itself just returns the approval request data.
    // The frontend intercepts this tool-call event via SSE and shows
    // the appropriate approval UI. The user's response comes back as
    // a new message in the next stream call.
    return {
      success: true,
      type: context.type,
      content: context.content,
    };
  },
});
