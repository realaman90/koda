import fs from 'node:fs';
import path from 'node:path';
import type { AgentPlugin } from '@/lib/plugins/types';
import { motionAnalyzerPlugin } from '@/lib/plugins/official/agents/motion-analyzer';
import { svgStudioPlugin } from '@/lib/plugins/official/agents/svg-studio';

function extractHandleIds(nodeSource: string, handleType: 'target' | 'source'): string[] {
  const regex = new RegExp(`<Handle[^>]*type="${handleType}"[^>]*id="([^"]+)"`, 'g');
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(nodeSource)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

function toSortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function assertSameSet(label: string, actual: string[], expected: string[]): string | null {
  const a = toSortedUnique(actual);
  const e = toSortedUnique(expected);
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) {
    return `${label}\n  expected: [${e.join(', ')}]\n  actual:   [${a.join(', ')}]`;
  }
  return null;
}

interface ContractCheck {
  plugin: AgentPlugin;
  nodeFile: string;
}

const checks: ContractCheck[] = [
  {
    plugin: motionAnalyzerPlugin,
    nodeFile: 'src/lib/plugins/official/agents/motion-analyzer/MotionAnalyzerNode.tsx',
  },
  {
    plugin: svgStudioPlugin,
    nodeFile: 'src/lib/plugins/official/agents/svg-studio/SvgStudioNode.tsx',
  },
];

const errors: string[] = [];

for (const check of checks) {
  const absolutePath = path.join(process.cwd(), check.nodeFile);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const renderedInputs = extractHandleIds(source, 'target');
  const renderedOutputs = extractHandleIds(source, 'source');
  const metadataInputs = check.plugin.handles?.inputs.map((handle) => handle.id) ?? [];
  const metadataOutputs = check.plugin.handles?.outputs.map((handle) => handle.id) ?? [];

  const inputError = assertSameSet(
    `${check.plugin.id}: metadata input handles must match rendered target handles`,
    renderedInputs,
    metadataInputs
  );
  if (inputError) errors.push(inputError);

  const outputError = assertSameSet(
    `${check.plugin.id}: metadata output handles must match rendered source handles`,
    renderedOutputs,
    metadataOutputs
  );
  if (outputError) errors.push(outputError);
}

if (errors.length > 0) {
  console.error('[validate-plugin-handle-contract] Contract validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('[validate-plugin-handle-contract] All plugin handle contracts passed.');
