import { validateDistributionRuntimeContract } from '../src/lib/distribution/capabilities';

const result = validateDistributionRuntimeContract();

console.log(
  `[distribution-contract] distribution=${result.distribution} source=${result.source} errors=${result.errors.length} warnings=${result.warnings.length}`
);

for (const warning of result.warnings) {
  console.warn(`[distribution-contract][warning] ${warning}`);
}

for (const error of result.errors) {
  console.error(`[distribution-contract][error] ${error}`);
}

if (result.errors.length > 0) {
  process.exit(1);
}
