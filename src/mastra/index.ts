import { Mastra } from '@mastra/core';
import { promptEnhancerAgent } from './agents/prompt-enhancer';
import { animationAgent } from './agents/animation-agent';

export const mastra = new Mastra({
  agents: {
    promptEnhancer: promptEnhancerAgent,
    animationAgent: animationAgent,
  },
});

export { promptEnhancerAgent, animationAgent };

// Re-export animation tools for use in API routes
export * from './tools/animation';
