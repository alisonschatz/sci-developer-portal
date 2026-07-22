import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apis, serverEnvVarName } from '../apis.config.js';

/** Regenera o .env.example a partir do manifesto — os nomes das
 *  variáveis são DERIVADOS dos ids, nunca declarados à mão. */
const lines = [
  '# Gerado a partir de apis.config.js — `npm run env:example` regenera.',
  '# Copie para .env e preencha. O .env NUNCA é commitado (.gitignore).',
  '',
];
for (const api of apis) {
  lines.push(`# ${api.title}`);
  lines.push(`${serverEnvVarName(api.id, 'production')}=`);
  lines.push(`${serverEnvVarName(api.id, 'homolog')}=`);
  lines.push('');
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.writeFileSync(path.join(ROOT, '.env.example'), lines.join('\n'));
console.log(lines.join('\n'));
console.error('(.env.example regenerado)');
