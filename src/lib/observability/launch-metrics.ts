import 'server-only';

import { resolveDistributionMode } from '@/lib/distribution/capabilities';

export type LaunchMetricName =
  | 'signup_completion'
  | 'workspace_bootstrap'
  | 'plugin_execution';

export type LaunchMetricStatus = 'success' | 'error';

export interface LaunchMetricEvent {
  metric: LaunchMetricName;
  status: LaunchMetricStatus;
  source: 'api' | 'webhook' | 'analytics';
  deployment: 'oss' | 'hosted';
  pluginId?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

function resolveDeploymentMode(): 'oss' | 'hosted' {
  return resolveDistributionMode().distribution;
}

/**
 * Emits structured JSON logs for roadmap launch KPIs.
 *
 * Prefix is intentionally stable so log backends can parse by filter:
 *   [launch-metric] { ...json }
 */
export function emitLaunchMetric(event: Omit<LaunchMetricEvent, 'deployment'> & { deployment?: LaunchMetricEvent['deployment'] }) {
  const payload: LaunchMetricEvent & { ts: string } = {
    ...event,
    deployment: event.deployment ?? resolveDeploymentMode(),
    ts: new Date().toISOString(),
  };

  const line = `[launch-metric] ${JSON.stringify(payload)}`;

  if (payload.status === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}
