import { Mastra } from '@mastra/core';
import { promptEnhancerAgent } from './agents/prompt-enhancer';
import { animationAgent } from './agents/animation-agent';
import { motionAnalyzerAgent } from './agents/motion-analyzer-agent';

export const mastra = new Mastra({
  agents: {
    promptEnhancer: promptEnhancerAgent,
    animationAgent: animationAgent,
    motionAnalyzer: motionAnalyzerAgent,
  },
});

export { promptEnhancerAgent, animationAgent, motionAnalyzerAgent };

// Re-export animation tools for use in API routes
export * from './tools/animation';
