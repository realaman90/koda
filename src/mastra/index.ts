import { Mastra } from '@mastra/core';
import { promptEnhancerAgent } from './agents/prompt-enhancer';
import { creativeAssistantAgent } from './agents/creative-assistant';

export const mastra = new Mastra({
  agents: {
    promptEnhancer: promptEnhancerAgent,
    creativeAssistant: creativeAssistantAgent,
  },
});

export { promptEnhancerAgent, creativeAssistantAgent };
