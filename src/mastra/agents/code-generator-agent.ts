/**
 * Code Generator Subagent
 *
 * Specialist agent for generating Theatre.js animation code.
 * Has no tools — pure generation. Called by the orchestrator
 * via the generate_code tool (subagent-as-tool pattern).
 *
 * Based on ANIMATION_PLUGIN.md Part 10.3
 */

import { Agent } from '@mastra/core/agent';
import { CODE_GENERATOR_INSTRUCTIONS } from './instructions/code-generator';

export const codeGeneratorAgent = new Agent({
  id: 'theatre-code-generator',
  name: 'theatre-code-generator',
  instructions: CODE_GENERATOR_INSTRUCTIONS,
  model: 'anthropic/claude-sonnet-4-5', //anthropic/claude-opus-4-5',
  // No tools — pure generation
});
