import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'

async function main() {
  const result = await Template.build(template, 'koda-remotion', {
    cpuCount: 8,
    memoryMB: 8192,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log('\n✅ Template built successfully!');
  console.log('Template ID:', result.templateId);
  console.log('\nAdd to your .env:');
  console.log(`E2B_TEMPLATE_ID=${result.templateId}`);
}

main().catch(console.error);
