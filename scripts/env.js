import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { apis, serverEnvVarName } from '../apis.config.js';

/**
 * `npm run env` — deixa o ambiente local pronto:
 *   1. Regenera o .env.example a partir do manifesto (nomes das
 *      variáveis são DERIVADOS dos ids — nunca declarados à mão).
 *   2. Cria o .env a partir do .env.example se não existir; se existir,
 *      só ACRESCENTA as chaves que faltam — valores preenchidos nunca
 *      são tocados.
 *   3. Avisa quais variáveis ainda estão vazias.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Linhas do .env.example derivadas do manifesto. */
export function buildEnvTemplate(entries = apis) {
  const lines = [
    '# Gerado a partir de apis.config.js — `npm run env` regenera/sincroniza.',
    '# O .env NUNCA é commitado (.gitignore).',
    '',
  ];
  for (const api of entries) {
    lines.push(`# ${api.title}`);
    lines.push(`${serverEnvVarName(api.id, 'production')}=`);
    lines.push(`${serverEnvVarName(api.id, 'homolog')}=`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Chaves "VAR=" presentes num conteúdo .env. */
export function parseEnvKeys(content) {
  const keys = new Map();
  for (const line of (content || '').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) keys.set(match[1], match[2]);
  }
  return keys;
}

/** Acrescenta ao .env existente as chaves do template que faltam.
 *  Retorna { content, added }. Valores existentes intocados. */
export function mergeEnvContent(template, existing) {
  const existingKeys = parseEnvKeys(existing);
  const templateKeys = [...parseEnvKeys(template).keys()];
  const missing = templateKeys.filter((k) => !existingKeys.has(k));
  if (missing.length === 0) return { content: existing, added: [] };
  const addition = ['', '# Adicionado por `npm run env` (chaves novas do manifesto)', ...missing.map((k) => `${k}=`), ''].join('\n');
  return { content: `${existing.replace(/\n*$/, '\n')}${addition}`, added: missing };
}

export function main() {
  const template = buildEnvTemplate();
  fs.writeFileSync(path.join(ROOT, '.env.example'), template);
  console.log('✅ .env.example regenerado a partir do manifesto.');

  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, template);
    console.log('✅ .env criado a partir do .env.example — preencha as URLs.');
  } else {
    const { content, added } = mergeEnvContent(template, fs.readFileSync(envPath, 'utf8'));
    if (added.length > 0) {
      fs.writeFileSync(envPath, content);
      console.log(`✅ .env atualizado — chaves novas: ${added.join(', ')} (valores existentes intocados).`);
    } else {
      console.log('✅ .env já tem todas as chaves do manifesto.');
    }
  }

  const empty = [...parseEnvKeys(fs.readFileSync(envPath, 'utf8'))].filter(([, v]) => !v).map(([k]) => k);
  if (empty.length > 0) console.log(`⚠️  Ainda sem valor no .env: ${empty.join(', ')}`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) main();
