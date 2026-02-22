import { z } from 'zod';
import type { AgentPlugin } from './types';

const agentCapabilitySchema = z.enum([
  'canvas:read',
  'canvas:create',
  'canvas:connect',
  'canvas:modify',
  'storage:upload',
  'storage:download',
  'sandbox:persistent',
]);

const pluginPolicySchema = z.object({
  capabilityDeclarations: z.array(agentCapabilitySchema).nonempty(),
  distributionVisibility: z.array(z.enum(['oss', 'hosted'])).nonempty(),
  trustTier: z.enum(['official', 'verified', 'community']),
}).superRefine((policy, ctx) => {
  const visibilitySet = new Set(policy.distributionVisibility);
  if (visibilitySet.size !== policy.distributionVisibility.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'policy.distributionVisibility cannot contain duplicates',
      path: ['distributionVisibility'],
    });
  }
});

const pluginSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  policy: pluginPolicySchema,
  capabilities: z.array(agentCapabilitySchema).nonempty(),
});

export function validatePluginPolicy(plugin: AgentPlugin): AgentPlugin {
  const parsed = pluginSchema.safeParse(plugin);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Plugin policy schema validation failed for \"${plugin.id}\": ${detail}`);
  }

  const declared = new Set(parsed.data.policy.capabilityDeclarations);
  const actual = new Set(parsed.data.capabilities);

  const missingDeclarations = [...actual].filter((capability) => !declared.has(capability));
  if (missingDeclarations.length > 0) {
    throw new Error(
      `Plugin policy schema validation failed for \"${plugin.id}\": missing capability declarations for [${missingDeclarations.join(', ')}]`
    );
  }

  return plugin;
}
