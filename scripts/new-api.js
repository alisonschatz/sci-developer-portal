import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

/**
 * Cria a estrutura inicial de arquivos e configurações para uma nova API:
 * npm run api:new -- <id> "<Título>"
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '  // ── Próxima API entra aqui (npm run api:new) ─────────────────────────';

/** Insere o bloco da nova API antes do marcador de posição. */
export function insertApiBlock(source, block) {
  if (!source.includes(MARKER)) {
    throw new Error('Marcador de inserção não encontrado em apis.config.js.');
  }
  return source.replace(MARKER, `${block}\n\n${MARKER}`);
}

export function buildApiBlock(id, title) {
  return `  {
    id: '${id}',
    title: '${title}',
    slug: '${id}',
    isAuthProvider: false,
    securityScheme: 'auto',
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
    console.error(`id inválido: "${id}" (formato esperado: kebab-case).`);
    process.exit(1);
  }

  const dir = path.join(ROOT, 'content', id);
  if (fs.existsSync(dir)) {
    console.error(`O diretório content/${id}/ já existe.`);
    process.exit(1);
  }
  fs.mkdirSync(path.join(dir, 'tags'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'operations'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'security'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'overview.md'),
    `## Sobre esta API\n\nDescreva aqui o propósito da API **${title}** e orientações para integração.\n\n> [!TIP]\n> O token gerado na aba Autenticação é reaproveitado nesta documentação.\n`
  );

  for (const [sub, file] of [['tags', '_modelo.md'], ['operations', '_modelo.md'], ['security', '_modelo.md']]) {
    const sourceModel = path.join(ROOT, 'content', 'auth', sub, file);
    if (fs.existsSync(sourceModel)) fs.copyFileSync(sourceModel, path.join(dir, sub, file));
  }

  const configPath = path.join(ROOT, 'apis.config.js');
  const block = buildApiBlock(id, title);
  try {
    fs.writeFileSync(configPath, insertApiBlock(fs.readFileSync(configPath, 'utf8'), block));
    console.log(`\n✅ Estrutura criada em content/${id}/.`);
    console.log('✅ Configuração adicionada em apis.config.js.');
    execFileSync('node', [path.join(ROOT, 'scripts/verify.js')], { stdio: 'inherit' });
    execFileSync('node', [path.join(ROOT, 'scripts/env.js')], { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n⚠️  ${error.message}`);
    console.log('Bloco para inserção manual em apis.config.js:\n');
    console.log(block);
  }

  const envPrefix = id.toUpperCase().replace(/-/g, '_');
  console.log('\nPróximos passos:');
  console.log(`  1. Configure ${envPrefix}_SERVER_URL no arquivo .env`);
  console.log('  2. Execute: npm run api:sync');
  console.log(`  3. Edite a documentação em content/${id}/`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) main();