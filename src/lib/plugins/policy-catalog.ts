import type { PluginPolicy } from '@/lib/plugins/types';

const OFFICIAL_PLUGIN_POLICY_CATALOG: Record<string, PluginPolicy> = {
  'storyboard-generator': {
    capabilityDeclarations: ['canvas:create', 'canvas:read'],
    distributionVisibility: ['oss', 'hosted'],
    trustTier: 'official',
  },
  'product-shot': {
    capabilityDeclarations: ['canvas:create', 'canvas:read'],
    distributionVisibility: ['oss', 'hosted'],
    trustTier: 'official',
  },
  'animation-generator': {
    capabilityDeclarations: ['canvas:read', 'storage:upload', 'sandbox:persistent'],
    distributionVisibility: ['oss', 'hosted'],
    trustTier: 'official',
  },
  'motion-analyzer': {
    capabilityDeclarations: ['canvas:read'],
    distributionVisibility: ['oss', 'hosted'],
    trustTier: 'official',
  },
};

export function getPluginPolicyFromCatalog(pluginId: string): PluginPolicy | undefined {
  return OFFICIAL_PLUGIN_POLICY_CATALOG[pluginId];
}
