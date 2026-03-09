import test from 'node:test';
import assert from 'node:assert/strict';

import { formatRemotionCodeGenerationPrompt } from './generate-remotion-code-tool';

test('Remotion prompt includes the injected best-practices adapter', () => {
  const prompt = formatRemotionCodeGenerationPrompt({
    task: 'create_component',
    name: 'AnimatedTitle',
    description: 'A title card with staged motion',
  });

  assert.match(prompt, /## REMOTION BEST PRACTICES/);
  assert.match(prompt, /useCurrentFrame\(\)/);
  assert.match(prompt, /staticFile\(\)/);
  assert.match(prompt, /@remotion\/transitions/);
});
