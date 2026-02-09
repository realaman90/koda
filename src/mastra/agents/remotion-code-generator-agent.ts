/**
 * Remotion Code Generator Subagent
 *
 * Specialist agent for generating Remotion (2D) animation code.
 * Has no tools — pure generation. Called by the orchestrator
 * via the generate_remotion_code tool (subagent-as-tool pattern).
 */

import { Agent } from '@mastra/core/agent';
import { REMOTION_CODE_GENERATOR_INSTRUCTIONS } from './instructions/remotion-code-generator';
import { REMOTION_CODE_GEN_MODEL } from '../models';

export const remotionCodeGeneratorAgent = new Agent({
  id: 'remotion-code-generator',
  name: 'Remotion Code Generator',
  instructions: REMOTION_CODE_GENERATOR_INSTRUCTIONS,
  model: REMOTION_CODE_GEN_MODEL,
  // No tools — pure generation
});
