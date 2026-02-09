import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'

async function main() {
  const result = await Template.build(template, 'koda-theatre', {
    cpuCount: 8,
    memoryMB: 8192,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log('\n✅ Template built successfully!');
  console.log('Template ID:', result.templateId);
  console.log('\nAdd to your .env:');
  console.log(`E2B_TEMPLATE_ID_THEATRE=${result.templateId}`);
}

main().catch((err) => {
  console.error('\n❌ Build failed!');
  console.error('Error:', err?.message || err);
  if (err?.response) console.error('Response:', JSON.stringify(err.response, null, 2));
  process.exit(1);
});
