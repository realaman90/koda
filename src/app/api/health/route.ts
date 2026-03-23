import { NextResponse } from 'next/server';

import { resolveDistributionMode, validateDistributionRuntimeContract } from '@/lib/distribution/capabilities';

export async function GET() {
  const { distribution, source } = resolveDistributionMode();
  const contract = validateDistributionRuntimeContract();

  return NextResponse.json({
    ok: true,
    distribution,
    source,
    contract: {
      errors: contract.errors.length,
      warnings: contract.warnings.length,
    },
    timestamp: new Date().toISOString(),
  });
}
