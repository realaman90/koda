#!/usr/bin/env tsx

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type LaunchMetricName = 'signup_completion' | 'workspace_bootstrap' | 'plugin_execution';
type Status = 'success' | 'error';
type Deployment = 'oss' | 'hosted';

interface EventLine {
  metric: LaunchMetricName;
  status: Status;
  deployment: Deployment;
  ts: string;
}

interface Totals {
  attempts: number;
  successes: number;
  errors: number;
  successRate: number;
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: npm run roadmap:baseline -- <log-file>');
  process.exit(1);
}

const logPath = resolve(process.cwd(), fileArg);
const raw = readFileSync(logPath, 'utf8');
const lines = raw.split('\n');

const events: EventLine[] = [];
for (const line of lines) {
  const marker = '[launch-metric] ';
  const idx = line.indexOf(marker);
  if (idx === -1) continue;

  const json = line.slice(idx + marker.length);
  try {
    const parsed = JSON.parse(json) as EventLine;
    events.push(parsed);
  } catch {
    // ignore malformed lines
  }
}

const deployments: Deployment[] = ['oss', 'hosted'];
const metrics: LaunchMetricName[] = ['signup_completion', 'workspace_bootstrap', 'plugin_execution'];

const summarize = (subset: EventLine[]): Totals => {
  const attempts = subset.length;
  const successes = subset.filter((e) => e.status === 'success').length;
  const errors = subset.filter((e) => e.status === 'error').length;
  const successRate = attempts ? Number(((successes / attempts) * 100).toFixed(2)) : 0;

  return { attempts, successes, errors, successRate };
};

const summary = deployments.map((deployment) => {
  const deploymentEvents = events.filter((e) => e.deployment === deployment);
  const byMetric = Object.fromEntries(
    metrics.map((metric) => [metric, summarize(deploymentEvents.filter((e) => e.metric === metric))])
  );

  const all = summarize(deploymentEvents);
  const errorRate = all.attempts ? Number(((all.errors / all.attempts) * 100).toFixed(2)) : 0;

  return {
    deployment,
    window: {
      start: deploymentEvents[0]?.ts ?? null,
      end: deploymentEvents[deploymentEvents.length - 1]?.ts ?? null,
    },
    kpis: byMetric,
    errorRate,
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2));
