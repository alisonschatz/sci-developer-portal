import { apis, validateManifest } from '../apis.config.js';

const errors = validateManifest();
if (errors.length > 0) {
  for (const error of errors) console.error(`❌ ${error}`);
  process.exit(1);
}
console.log(`✅ Manifesto válido — ${apis.length} API(s): ${apis.map((a) => a.id).join(', ')}`);
