import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { apis, getDocsUrl, ENVIRONMENTS } from '../apis.config.js';

/**
 * Baixa o spec bruto de cada API do ambiente escolhido e grava em
 * src/base/openapi-<id>.json, após o filtro de segurança (blacklist).
 *
 * Ambiente:  node scripts/fetch.js [production|homolog]
 *            (ou PORTAL_ENV=homolog; padrão: production)
 *
 * A URL de docs é SEMPRE derivada: <serverUrl><docsPath> — não existe
 * URL de docs separada pra configurar. As URLs base vêm de variáveis de
 * ambiente (<ID>_SERVER_URL / <ID>_SERVER_URL_HML) — `npm run env`.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveEnvironment(argv = process.argv, env = process.env) {
  const fromArg = argv[2];
  const fromEnv = env.PORTAL_ENV;
  const chosen = fromArg || fromEnv || 'production';
  if (!ENVIRONMENTS.includes(chosen)) {
    throw new Error(`Ambiente inválido: "${chosen}". Use: ${ENVIRONMENTS.join(' | ')}.`);
  }
  return chosen;
}

const BLACKLIST_PATTERNS = [
  /\/admin(\/|$)/i,
  /\/internal(\/|$)/i,
  /\/debug(\/|$)/i,
  /\/health(check)?(\/|$)/i,
  /\/metrics(\/|$)/i,
  /\/swagger/i,
  /\/docs(\/|$)/i,
];

export function isBlacklisted(routePath) {
  return BLACKLIST_PATTERNS.some((pattern) => pattern.test(routePath));
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

/**
 * Remove do spec tudo que o backend marcou como interno:
 *   1. rotas que batem na blacklist de padrões (admin/internal/debug/...)
 *   2. path items com `x-internal: true` (a rota inteira)
 *   3. operações individuais com `x-internal: true`
 * Retorna { spec, removed } (contagem de rotas + operações removidas).
 */
export function filterInternalRoutes(spec) {
  if (!spec.paths) return { spec, removed: 0 };
  const paths = {};
  let removed = 0;
  for (const [routePath, pathItem] of Object.entries(spec.paths)) {
    if (isBlacklisted(routePath)) { removed += 1; continue; }
    if (pathItem && pathItem['x-internal'] === true) { removed += 1; continue; }

    let item = pathItem;
    const internalOps = HTTP_METHODS.filter((m) => item?.[m] && item[m]['x-internal'] === true);
    if (internalOps.length > 0) {
      item = { ...item };
      for (const m of internalOps) { delete item[m]; removed += 1; }
      // rota sem nenhuma operação restante some junto
      if (!HTTP_METHODS.some((m) => item[m])) continue;
    }
    paths[routePath] = item;
  }
  return { spec: { ...spec, paths }, removed };
}

async function fetchApi(api, environment) {
  let url;
  try {
    url = getDocsUrl(api, environment);
  } catch (error) {
    console.error(`[fetch] (${api.id}) ${error.message} Preencha servers.${environment} em apis.config.js.`);
    return false;
  }

  console.log(`[fetch] (${api.id}) [${environment}] baixando ${url} ...`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[fetch] (${api.id}) falha: HTTP ${response.status}`);
    return false;
  }

  const raw = await response.json();
  const { spec, removed } = filterInternalRoutes(raw);
  if (removed > 0) console.log(`[fetch] (${api.id}) Rotas filtradas pela blacklist: ${removed}.`);

  const outPath = path.join(ROOT, 'src', 'base', `openapi-${api.id}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`[fetch] (${api.id}) ✅ salvo em ${path.relative(ROOT, outPath)}`);
  return true;
}

export async function main() {
  const environment = resolveEnvironment();
  console.log(`[fetch] ambiente: ${environment}`);
  let ok = true;
  for (const api of apis) {
    // eslint-disable-next-line no-await-in-loop
    ok = (await fetchApi(api, environment)) && ok;
  }
  if (!ok) process.exit(1);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) main();
