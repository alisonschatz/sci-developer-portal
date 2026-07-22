import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

/**
 * Scaffold completo de uma API nova:
 *   npm run api:new -- <id> "<Título>"
 *
 * 1. Cria content/<id>/ (overview + modelos de tags/operations/security)
 * 2. INSERE o bloco no apis.config.js sozinho (no marcador)
 * 3. Sincroniza o .env (npm run env) com as variáveis novas
 * 4. Avisa exatamente o que falta preencher
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '  // ── Próxima API entra aqui (npm run api:new) ─────────────────────────';

/** Insere o bloco antes do marcador, preservando o marcador pra próxima. */
export function insertApiBlock(source, block) {
  if (!source.includes(MARKER)) {
    throw new Error('Marcador de inserção não encontrado em apis.config.js — cole o bloco manualmente.');
  }
  return source.replace(MARKER, `${block}\n\n${MARKER}`);
}

export function buildApiBlock(id, title) {
  return `  {
    id: '${id}',
    title: '${title}',
    slug: '${id}',
    isAuthProvider: false,
    securityScheme: 'auto', // o build resolve sozinho lendo o spec baixado
    default: false,
  },`;
}

function main() {
  const [id, title] = process.argv.slice(2);
  if (!id || !title) {
    console.error('Uso: npm run api:new -- <id> "<Título>"');
    console.error('Ex.: npm run api:new -- nova-api "Nova API"');
    process.exit(1);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    console.error(`id inválido: "${id}" (esperado kebab-case, ex.: nova-api)`);
    process.exit(1);
  }

  const dir = path.join(ROOT, 'content', id);
  if (fs.existsSync(dir)) {
    console.error(`content/${id}/ já existe — abortando pra não sobrescrever.`);
    process.exit(1);
  }
  fs.mkdirSync(path.join(dir, 'tags'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'operations'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'security'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'overview.md'),
    `## Sobre esta API\n\nDescreva aqui o que a **${title}** faz, pra quem é, e como começar.\n\n> [!TIP]\n> O token gerado na aba Autenticação já vale aqui — não precisa autenticar de novo.\n`
  );
  // Modelos copiados de uma API existente (referência completa de campos)
  for (const [sub, file] of [['tags', '_modelo.md'], ['operations', '_modelo.md'], ['security', '_modelo.md']]) {
    const sourceModel = path.join(ROOT, 'content', 'auth', sub, file);
    if (fs.existsSync(sourceModel)) fs.copyFileSync(sourceModel, path.join(dir, sub, file));
  }

  const configPath = path.join(ROOT, 'apis.config.js');
  const block = buildApiBlock(id, title);
  try {
    fs.writeFileSync(configPath, insertApiBlock(fs.readFileSync(configPath, 'utf8'), block));
    console.log(`\n✅ content/${id}/ criado.`);
    console.log('✅ Bloco adicionado automaticamente em apis.config.js.');
    execFileSync('node', [path.join(ROOT, 'scripts/verify.js')], { stdio: 'inherit' });
    execFileSync('node', [path.join(ROOT, 'scripts/env.js')], { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n⚠️  ${error.message}`);
    console.log('Bloco pra colar manualmente em apis.config.js:\n');
    console.log(block);
  }

  const envPrefix = id.toUpperCase().replace(/-/g, '_');
  console.log('\n📝 Falta preencher:');
  console.log(`   1. ${envPrefix}_SERVER_URL no .env (URL de produção da API) — e como secret no CI`);
  console.log('   2. Rode: npm run api:sync   (fetch + build; o securityScheme é detectado do spec)');
  console.log(`   3. Escreva o conteúdo em content/${id}/ (comece pelo overview.md)`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) main();
