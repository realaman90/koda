/**
 * UI Tools for Motion Analyzer
 *
 * Lightweight versions of animation plugin UI tools.
 * These are "no-op" tools — the real work happens in the frontend
 * when it processes the tool-call SSE events.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * set_thinking - Update the thinking/status message
 */
export const setThinkingTool = createTool({
  id: 'set_thinking',
  description: 'Set the thinking/status message shown to the user. Use this to explain what you are doing.',
  inputSchema: z.object({
    message: z.string().describe('The thinking/status message'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async () => {
    // No-op — frontend reads the tool-call args
    return { success: true };
  },
});

/**
 * add_message - Send a message to the chat
 */
export const addMessageTool = createTool({
  id: 'add_message',
  description: 'Send a message to the user in the chat. Use this for important updates or responses.',
  inputSchema: z.object({
    content: z.string().describe('The message content'),
    messageId: z.string().optional().describe('Optional unique ID for the message'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string(),
  }),
  execute: async (input) => {
    return {
      success: true,
      messageId: input.messageId || `msg_${Date.now()}`,
    };
  },
});
