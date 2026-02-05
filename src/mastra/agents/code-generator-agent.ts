/**
 * Theatre.js Code Generator Subagent
 *
 * Specialist agent for generating Theatre.js (3D) animation code.
 * Has no tools — pure generation. Called by the orchestrator
 * via the generate_code tool (subagent-as-tool pattern).
 */

import { Agent } from '@mastra/core/agent';
import { CODE_GENERATOR_INSTRUCTIONS } from './instructions/code-generator';

export const codeGeneratorAgent = new Agent({
  id: 'theatre-code-generator',
  name: 'Theatre.js Code Generator',
  instructions: CODE_GENERATOR_INSTRUCTIONS,
  model: 'openrouter/moonshotai/kimi-k2.5',
  // No tools — pure generation
});
