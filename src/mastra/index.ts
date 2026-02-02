import { Mastra } from '@mastra/core';
import { promptEnhancerAgent } from './agents/prompt-enhancer';
import { creativeAssistantAgent } from './agents/creative-assistant';
import { animationAgent } from './agents/animation-agent';

export const mastra = new Mastra({
  agents: {
    promptEnhancer: promptEnhancerAgent,
    creativeAssistant: creativeAssistantAgent,
    animationAgent: animationAgent,
  },
});

export { promptEnhancerAgent, creativeAssistantAgent, animationAgent };

// Re-export animation tools for use in API routes
export * from './tools/animation';
