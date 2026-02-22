export type Distribution = 'oss' | 'hosted';

export type DistributionCapability =
  | 'auth_v1'
  | 'workspaces_v1'
  | 'collab_sharing_v1'
  | 'local_sqlite'
  | 'turso_sqlite'
  | 'local_assets'
  | 'r2_assets'
  | 's3_assets'
  | 'docker_sandbox'
  | 'e2b_sandbox'
  | 'local_snapshots'
  | 'r2_snapshots';

export type RuntimeFeature = 'authV1' | 'workspacesV1' | 'collabSharingV1';

const DISTRIBUTION_CAPABILITY_MATRIX: Record<Distribution, Record<DistributionCapability, boolean>> = {
  oss: {
    auth_v1: true,
    workspaces_v1: true,
    collab_sharing_v1: true,
    local_sqlite: true,
    turso_sqlite: true,
    local_assets: true,
    r2_assets: true,
    s3_assets: true,
    docker_sandbox: true,
    e2b_sandbox: true,
    local_snapshots: true,
    r2_snapshots: true,
  },
  hosted: {
    auth_v1: true,
    workspaces_v1: true,
    collab_sharing_v1: true,
    local_sqlite: true,
    turso_sqlite: true,
    local_assets: true,
    r2_assets: true,
    s3_assets: true,
    docker_sandbox: true,
    e2b_sandbox: true,
    local_snapshots: true,
    r2_snapshots: true,
  },
};

const RUNTIME_FEATURE_CAPABILITY: Record<RuntimeFeature, DistributionCapability> = {
  authV1: 'auth_v1',
  workspacesV1: 'workspaces_v1',
  collabSharingV1: 'collab_sharing_v1',
};

export interface DistributionResolution {
  distribution: Distribution;
  source: 'explicit' | 'inferred';
}

function normalizeDistribution(value?: string): Distribution | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'oss' || normalized === 'hosted') {
    return normalized;
  }
  return null;
}

/**
 * Resolve runtime distribution mode.
 *
 * Fallback behavior:
 * 1) explicit env (`KODA_DISTRIBUTION` or `NEXT_PUBLIC_KODA_DISTRIBUTION`)
 * 2) infer hosted profile when cloud providers are configured
 * 3) fallback to `oss`
 */
export function resolveDistributionMode(): DistributionResolution {
  const explicit =
    normalizeDistribution(process.env.KODA_DISTRIBUTION) ??
    normalizeDistribution(process.env.NEXT_PUBLIC_KODA_DISTRIBUTION) ??
    normalizeDistribution(process.env.KODA_LAUNCH_ENV);

  if (explicit) {
    return { distribution: explicit, source: 'explicit' };
  }

  const isHosted =
    process.env.SANDBOX_PROVIDER === 'e2b' ||
    !!process.env.TURSO_DATABASE_URL ||
    process.env.ASSET_STORAGE === 'r2' ||
    process.env.SNAPSHOT_STORAGE === 'r2';

  return {
    distribution: isHosted ? 'hosted' : 'oss',
    source: 'inferred',
  };
}

export function isCapabilityAvailable(capability: DistributionCapability): boolean {
  const { distribution } = resolveDistributionMode();
  return DISTRIBUTION_CAPABILITY_MATRIX[distribution][capability];
}

function isFlagEnabled(flagName: string): boolean {
  return process.env[flagName] !== 'false';
}

export function isRuntimeFeatureEnabled(feature: RuntimeFeature, flagName: string): boolean {
  const capability = RUNTIME_FEATURE_CAPABILITY[feature];
  if (!isCapabilityAvailable(capability)) {
    return false;
  }
  return isFlagEnabled(flagName);
}

export interface RuntimeContractValidation {
  distribution: Distribution;
  source: DistributionResolution['source'];
  errors: string[];
  warnings: string[];
}

/**
 * Runtime configuration validation for dual-distribution profiles.
 */
export function validateDistributionRuntimeContract(): RuntimeContractValidation {
  const { distribution, source } = resolveDistributionMode();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    warnings.push('Clerk keys are not fully configured (auth-related routes may fail).');
  }

  const sandboxProvider = process.env.SANDBOX_PROVIDER ?? 'docker';
  if (sandboxProvider === 'e2b') {
    if (!process.env.E2B_API_KEY) {
      errors.push('SANDBOX_PROVIDER=e2b requires E2B_API_KEY.');
    }
    if (!process.env.E2B_TEMPLATE_ID_REMOTION && !process.env.E2B_TEMPLATE_ID) {
      errors.push('SANDBOX_PROVIDER=e2b requires E2B_TEMPLATE_ID_REMOTION or E2B_TEMPLATE_ID.');
    }
  }

  const assetStorage = process.env.ASSET_STORAGE ?? 'local';
  if (assetStorage === 'r2') {
    const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'].filter(
      (name) => !process.env[name]
    );
    if (missing.length > 0) {
      errors.push(`ASSET_STORAGE=r2 missing required vars: ${missing.join(', ')}.`);
    }
  }

  if (assetStorage === 's3') {
    const missing = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'].filter(
      (name) => !process.env[name]
    );
    if (missing.length > 0) {
      errors.push(`ASSET_STORAGE=s3 missing required vars: ${missing.join(', ')}.`);
    }
  }

  if (process.env.SNAPSHOT_STORAGE === 'r2') {
    const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'].filter(
      (name) => !process.env[name]
    );
    if (missing.length > 0) {
      errors.push(`SNAPSHOT_STORAGE=r2 missing required vars: ${missing.join(', ')}.`);
    }
  }

  if (process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN) {
    warnings.push('TURSO_DATABASE_URL is set without TURSO_AUTH_TOKEN (may fail for protected databases).');
  }

  if (distribution === 'hosted') {
    if (sandboxProvider !== 'e2b') {
      warnings.push('Hosted profile usually expects SANDBOX_PROVIDER=e2b.');
    }
    if (!process.env.TURSO_DATABASE_URL) {
      warnings.push('Hosted profile usually expects TURSO_DATABASE_URL for persistent cloud DB.');
    }
  }

  return {
    distribution,
    source,
    errors,
    warnings,
  };
}

export function getDistributionCapabilityMatrix() {
  return DISTRIBUTION_CAPABILITY_MATRIX;
}
