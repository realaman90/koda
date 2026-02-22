import type { AgentPlugin, PluginDistribution, PluginPolicy, PluginTrustTier } from './types';
import { resolveDistributionMode } from '@/lib/distribution/capabilities';
import { getPluginPolicyFromCatalog } from './policy-catalog';

export type PluginPolicyDecisionCode =
  | 'PLUGIN_ALLOWED'
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_DISTRIBUTION_BLOCKED'
  | 'PLUGIN_TRUST_TIER_BLOCKED';

export interface PluginLaunchDecision {
  allowed: boolean;
  code: PluginPolicyDecisionCode;
  reason: string;
  pluginId: string;
  distribution: PluginDistribution;
  trustTier?: PluginTrustTier;
}

function parseTrustTiers(value?: string): Set<PluginTrustTier> | null {
  if (!value) return null;

  const normalized = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const allowed = new Set<PluginTrustTier>();
  for (const tier of normalized) {
    if (tier === 'official' || tier === 'verified' || tier === 'community') {
      allowed.add(tier);
    }
  }

  return allowed.size > 0 ? allowed : null;
}

export function resolveAllowedTrustTiers(distribution: PluginDistribution): Set<PluginTrustTier> {
  const envOverride =
    parseTrustTiers(process.env.KODA_PLUGIN_TRUST_TIERS) ??
    parseTrustTiers(process.env.NEXT_PUBLIC_KODA_PLUGIN_TRUST_TIERS);

  if (envOverride) {
    return envOverride;
  }

  if (distribution === 'hosted') {
    return new Set<PluginTrustTier>(['official', 'verified']);
  }

  return new Set<PluginTrustTier>(['official', 'verified', 'community']);
}

function evaluatePolicy(pluginId: string, policy?: PluginPolicy): PluginLaunchDecision {
  const { distribution } = resolveDistributionMode();

  if (!policy) {
    return {
      allowed: false,
      code: 'PLUGIN_NOT_FOUND',
      reason: 'Plugin policy metadata not found for requested plugin.',
      pluginId,
      distribution,
    };
  }

  if (!policy.distributionVisibility.includes(distribution)) {
    return {
      allowed: false,
      code: 'PLUGIN_DISTRIBUTION_BLOCKED',
      reason: `Plugin is not available in \"${distribution}\" distribution.`,
      pluginId,
      distribution,
      trustTier: policy.trustTier,
    };
  }

  const allowedTrustTiers = resolveAllowedTrustTiers(distribution);
  if (!allowedTrustTiers.has(policy.trustTier)) {
    return {
      allowed: false,
      code: 'PLUGIN_TRUST_TIER_BLOCKED',
      reason: `Plugin trust tier \"${policy.trustTier}\" is blocked for \"${distribution}\" distribution.`,
      pluginId,
      distribution,
      trustTier: policy.trustTier,
    };
  }

  return {
    allowed: true,
    code: 'PLUGIN_ALLOWED',
    reason: 'Plugin launch policy check passed.',
    pluginId,
    distribution,
    trustTier: policy.trustTier,
  };
}

export function evaluatePluginLaunchPolicy(plugin: Pick<AgentPlugin, 'id' | 'policy'>): PluginLaunchDecision {
  return evaluatePolicy(plugin.id, plugin.policy);
}

export function evaluatePluginLaunchById(pluginId: string): PluginLaunchDecision {
  return evaluatePolicy(pluginId, getPluginPolicyFromCatalog(pluginId));
}

export function emitPluginPolicyAuditEvent(params: {
  source: 'launcher' | 'api';
  decision: PluginLaunchDecision;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    ts: new Date().toISOString(),
    source: params.source,
    decision: params.decision.allowed ? 'allow' : 'deny',
    code: params.decision.code,
    reason: params.decision.reason,
    pluginId: params.decision.pluginId,
    distribution: params.decision.distribution,
    trustTier: params.decision.trustTier ?? null,
    metadata: params.metadata ?? null,
  };

  const line = `[plugin-policy-audit] ${JSON.stringify(payload)}`;
  if (params.decision.allowed) {
    console.log(line);
    return;
  }

  console.warn(line);
}
