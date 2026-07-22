import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { apis, validateManifest, getServerUrl, SHARED_TOKEN_VARIABLE } from '../apis.config.js';
import { resolveEnvironment } from './fetch.js';

/**
 * Mescla as especificações OpenAPI brutas (src/base/openapi-<id>.json)
 * com o conteúdo editorial em content/<id>/ e grava o resultado em public/openapi/<id>.json.
 *
 * Estrutura aceita em content/<id>/:
 * - overview.md: frontmatter (title, version) e descrição geral da API.
 * - tags/*.md: overrides de tags (tag, renameTo, hide e descrição).
 * - operations/*.md: overrides de operações (operation, summary, hide, deprecated, moveToTag, parameters e descrição).
 * - operations/*.example.json: exemplos de payload de requisição.
 * - operations/*.response-<status>.example.json: exemplos de respostas por status HTTP.
 * - security/*.md: descrições dos esquemas de autenticação (scheme e corpo).
 *
 * Arquivos iniciados com "_" são ignorados.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- Funções Utilitárias de Transformação ---

/** Aplica title e version a partir do frontmatter de overview.md. */
export function applyInfo(spec, info) {
  if (!info) return spec;
  const updated = { ...(spec.info || {}) };
  if (info.title) updated.title = info.title;
  if (info.version) updated.version = String(info.version);
  return { ...spec, info: updated };
}

/** Define a descrição geral da API (body do overview.md -> info.description). */
export function applyOverview(spec, overviewMarkdown) {
  if (!overviewMarkdown || !overviewMarkdown.trim()) return spec;
  return { ...spec, info: { ...(spec.info || {}), description: overviewMarkdown } };
}

/** Injeta a URL do servidor caso a especificação original não declare nenhuma. */
export function applyServers(spec, serverUrl) {
  if (!serverUrl) return spec;
  if (Array.isArray(spec.servers) && spec.servers.length > 0) return spec;
  return { ...spec, servers: [{ url: serverUrl }] };
}

/**
 * Mapeia as operações declaradas em spec.paths aplicando a função de callback.
 * O retorno Symbol('remove') exclui a operação.
 */
const REMOVE = Symbol('remove');
function mapOperations(spec, fn) {
  if (!spec.paths) return spec;
  const paths = {};
  for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
    const newItem = { ...pathItem };
    for (const [method, operation] of Object.entries(pathItem)) {
      if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) continue;
      const result = fn(pathKey, method, operation);
      if (result === REMOVE) delete newItem[method];
      else if (result) newItem[method] = result;
    }
    const hasOperations = Object.keys(newItem).some((k) => typeof newItem[k] === 'object' && newItem[k] !== null);
    if (hasOperations) paths[pathKey] = newItem;
  }
  return { ...spec, paths };
}

const opKey = (pathKey, method) => `${method.toUpperCase()} ${pathKey}`;

/** Remove operações marcadas com hide: true. */
export function applyOperationVisibility(spec, operations) {
  if (!operations) return spec;
  return mapOperations(spec, (pathKey, method) => {
    const entry = operations[opKey(pathKey, method)];
    return entry && entry.hide === true ? REMOVE : null;
  });
}

/** Move a operação para outra tag (cria a tag no spec caso não exista). */
export function applyOperationMoves(spec, operations) {
  if (!operations) return spec;
  const createdTags = new Set();
  const result = mapOperations(spec, (pathKey, method, operation) => {
    const entry = operations[opKey(pathKey, method)];
    if (!entry || !entry.moveToTag) return null;
    createdTags.add(entry.moveToTag);
    return { ...operation, tags: [entry.moveToTag] };
  });
  if (createdTags.size === 0) return result;
  const existing = new Set((result.tags || []).map((t) => t.name));
  const tags = [...(result.tags || [])];
  for (const name of createdTags) {
    if (!existing.has(name)) tags.push({ name });
  }
  return { ...result, tags };
}

/** Aplica overrides de summary, description, status de descontinuação e parâmetros. */
export function applyOperationOverrides(spec, operations) {
  if (!operations) return spec;
  return mapOperations(spec, (pathKey, method, operation) => {
    const entry = operations[opKey(pathKey, method)];
    if (!entry) return null;
    const updated = { ...operation };
    if (entry.summary) updated.summary = entry.summary;
    if (entry.description) updated.description = entry.description;
    if (entry.deprecated === true) updated.deprecated = true;
    if (entry.parameters && Array.isArray(operation.parameters)) {
      updated.parameters = operation.parameters.map((param) =>
        param.name && entry.parameters[param.name] ? { ...param, description: entry.parameters[param.name] } : param
      );
    }
    return updated;
  });
}

/** Injeta exemplos de corpo de requisição na operação. */
export function applyExamples(spec, examples) {
  if (!examples) return spec;
  return mapOperations(spec, (pathKey, method, operation) => {
    const example = examples[opKey(pathKey, method)];
    if (example === undefined || !operation.requestBody?.content) return null;
    const content = { ...operation.requestBody.content };
    for (const mediaType of Object.keys(content)) content[mediaType] = { ...content[mediaType], example };
    return { ...operation, requestBody: { ...operation.requestBody, content } };
  });
}

/** Injeta exemplos de respostas por código de status HTTP. */
export function applyResponseExamples(spec, responseExamples) {
  if (!responseExamples) return spec;
  return mapOperations(spec, (pathKey, method, operation) => {
    const byStatus = responseExamples[opKey(pathKey, method)];
    if (!byStatus || !operation.responses) return null;
    const responses = { ...operation.responses };
    for (const [status, example] of Object.entries(byStatus)) {
      const response = responses[status];
      if (!response?.content) continue;
      const content = { ...response.content };
      for (const mediaType of Object.keys(content)) content[mediaType] = { ...content[mediaType], example };
      responses[status] = { ...response, content };
    }
    return { ...operation, responses };
  });
}

/** Oculta tags marcadas com hide: true e remove todas as suas operações vinculadas. */
export function applyTagVisibility(spec, tagOverrides) {
  if (!tagOverrides) return spec;
  const hidden = new Set(Object.entries(tagOverrides).filter(([, e]) => e.hide === true).map(([name]) => name));
  if (hidden.size === 0) return spec;
  let result = mapOperations(spec, (pathKey, method, operation) => {
    const tags = operation.tags || [];
    return tags.some((t) => hidden.has(t)) ? REMOVE : null;
  });
  if (Array.isArray(result.tags)) result = { ...result, tags: result.tags.filter((t) => !hidden.has(t.name)) };
  return result;
}

/** Atualiza descrições de tags. Preserva a original se não houver override. */
export function applyTagDescriptions(spec, tagOverrides) {
  if (!tagOverrides || !Array.isArray(spec.tags)) return spec;
  const tags = spec.tags.map((tag) => {
    const entry = tag.name && tagOverrides[tag.name];
    if (entry && entry.description) return { ...tag, description: entry.description };
    return tag;
  });
  return { ...spec, tags };
}

/**
 * Renomeia tags e atualiza as referências em todas as operações.
 * Deve ser executado por último, pois os demais overrides usam os nomes originais.
 */
export function applyTagRenames(spec, tagOverrides) {
  if (!tagOverrides) return spec;
  const renames = new Map(
    Object.entries(tagOverrides)
      .filter(([, e]) => typeof e.renameTo === 'string' && e.renameTo.trim())
      .map(([from, e]) => [from, e.renameTo.trim()])
  );
  if (renames.size === 0) return spec;

  let result = spec;
  if (Array.isArray(result.tags)) {
    result = { ...result, tags: result.tags.map((tag) => (renames.has(tag.name) ? { ...tag, name: renames.get(tag.name) } : tag)) };
  }
  result = mapOperations(result, (pathKey, method, operation) => {
    if (!Array.isArray(operation.tags)) return null;
    const tags = operation.tags.map((t) => (renames.has(t) ? renames.get(t) : t));
    return tags.some((t, i) => t !== operation.tags[i]) ? { ...operation, tags } : null;
  });
  return result;
}

/** Remove tags que não possuem nenhuma operação associada. */
export function pruneEmptyTags(spec) {
  if (!Array.isArray(spec.tags) || !spec.paths) return spec;
  const used = new Set();
  mapOperations(spec, (pathKey, method, operation) => {
    for (const t of operation.tags || []) used.add(t);
    return null;
  });
  return { ...spec, tags: spec.tags.filter((t) => used.has(t.name)) };
}

/** Atualiza descrições dos esquemas de segurança em components.securitySchemes. */
export function applySecurityDescriptions(spec, security) {
  if (!security) return spec;
  const schemes = spec.components?.securitySchemes;
  if (!schemes) return spec;
  const updated = { ...schemes };
  for (const [name, entry] of Object.entries(security)) {
    if (updated[name] && entry.description) updated[name] = { ...updated[name], description: entry.description };
  }
  return { ...spec, components: { ...spec.components, securitySchemes: updated } };
}

/**
 * Executa as transformações do spec em ordem sequencial:
 * 1. Servidores, dados gerais e overview
 * 2. Ocultação de operações e tags (nomes originais)
 * 3. Reorganização de tags/operações
 * 4. Overrides de detalhes das operações e exemplos
 * 5. Descrições de tags e esquemas de segurança
 * 6. Renomeação de tags
 * 7. Limpeza de tags não utilizadas
 */
export function transformSpec(spec, content, { serverUrl } = {}) {
  let result = spec;
  result = applyServers(result, serverUrl);
  result = applyInfo(result, content.info);
  result = applyOverview(result, content.overview);
  result = applyOperationVisibility(result, content.operations);
  result = applyTagVisibility(result, content.tags);
  result = applyOperationMoves(result, content.operations);
  result = applyOperationOverrides(result, content.operations);
  result = applyExamples(result, content.examples);
  result = applyResponseExamples(result, content.responseExamples);
  result = applyTagDescriptions(result, content.tags);
  result = applySecurityDescriptions(result, content.security);
  result = applyTagRenames(result, content.tags);
  result = pruneEmptyTags(result);
  return result;
}

/** Mapeia e alerta sobre overrides configurados para elementos inexistentes no spec. */
export function findOrphanOverrides(spec, content) {
  const warnings = [];
  const opExists = (key) => {
    const [method, ...parts] = key.split(' ');
    return Boolean(spec.paths?.[parts.join(' ')]?.[method.toLowerCase()]);
  };
  for (const key of Object.keys(content.operations || {})) {
    if (!opExists(key)) warnings.push(`"${key}" não existe no spec — override ignorado.`);
  }
  for (const key of Object.keys(content.responseExamples || {})) {
    if (!opExists(key)) warnings.push(`"${key}" (exemplo de resposta) não existe no spec — ignorado.`);
  }
  if (content.tags && Array.isArray(spec.tags)) {
    const names = new Set(spec.tags.map((t) => t.name));
    for (const tagName of Object.keys(content.tags)) {
      if (!names.has(tagName)) warnings.push(`Tag "${tagName}" não existe no spec — override ignorado.`);
    }
  }
  if (content.security) {
    const schemes = new Set(Object.keys(spec.components?.securitySchemes || {}));
    for (const name of Object.keys(content.security)) {
      if (!schemes.has(name)) warnings.push(`Security scheme "${name}" não existe no spec — override ignorado.`);
    }
  }

  for (const [key, entry] of Object.entries(content.operations || {})) {
    if (!entry.parameters || !opExists(key)) continue;
    const [method, ...parts] = key.split(' ');
    const op = spec.paths[parts.join(' ')][method.toLowerCase()];
    const paramNames = new Set((op.parameters || []).map((p) => p.name));
    for (const paramName of Object.keys(entry.parameters)) {
      if (!paramNames.has(paramName)) warnings.push(`"${key}": parâmetro "${paramName}" não existe na operação — descrição ignorada.`);
    }
  }
  return warnings;
}

// --- Leitura de Arquivos de Conteúdo ---

export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: null, body: raw.trim() };
  try {
    return { data: yaml.load(match[1]) || {}, body: match[2].trim() };
  } catch (error) {
    return { data: null, body: match[2].trim(), error: `frontmatter inválido (YAML): ${error.message}` };
  }
}

export function loadContent(apiId, root = ROOT) {
  const dir = path.join(root, 'content', apiId);
  const warnings = [];

  const listMd = (subdir) => {
    const full = path.join(dir, subdir);
    if (!fs.existsSync(full)) return [];
    return fs
      .readdirSync(full)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .sort()
      .map((f) => ({ file: `${subdir}/${f}`, full: path.join(full, f) }));
  };

  let overview = null;
  let info = null;
  const overviewPath = path.join(dir, 'overview.md');
  if (fs.existsSync(overviewPath)) {
    const { data, body, error } = parseFrontmatter(fs.readFileSync(overviewPath, 'utf8'));
    if (error) warnings.push(`overview.md: ${error} — frontmatter ignorado, corpo aplicado.`);
    overview = body || null;
    if (data && (data.title || data.version)) info = { title: data.title, version: data.version };
  }

  const tags = {};
  for (const { file, full } of listMd('tags')) {
    const { data, body, error } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
    if (error) { warnings.push(`${file}: ${error} — ignorado.`); continue; }
    if (!data || !data.tag) {
      warnings.push(`${file}: sem "tag:" no frontmatter — ignorado.`);
      continue;
    }
    if (tags[data.tag]) warnings.push(`${file}: tag "${data.tag}" já definida em outro arquivo — este sobrescreve.`);
    const entry = {};
    if (body) entry.description = body;
    if (data.renameTo) entry.renameTo = data.renameTo;
    if (data.hide === true) entry.hide = true;
    tags[data.tag] = entry;
  }

  const operations = {};
  const examples = {};
  const responseExamples = {};
  const opsDir = path.join(dir, 'operations');
  for (const { file, full } of listMd('operations')) {
    const { data, body, error } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
    if (error) { warnings.push(`${file}: ${error} — ignorado.`); continue; }
    if (!data || !data.operation) {
      warnings.push(`${file}: sem "operation:" no frontmatter — ignorado.`);
      continue;
    }
    const key = data.operation;
    if (operations[key]) warnings.push(`${file}: operação "${key}" já definida em outro arquivo — este sobrescreve.`);

    const entry = {};
    if (data.summary) entry.summary = data.summary;
    if (body) entry.description = body;
    if (data.hide === true) entry.hide = true;
    if (data.deprecated === true) entry.deprecated = true;
    if (data.moveToTag) entry.moveToTag = data.moveToTag;
    if (data.parameters && typeof data.parameters === 'object') entry.parameters = data.parameters;
    operations[key] = entry;

    const base = full.replace(/\.md$/, '');
    const requestExamplePath = `${base}.example.json`;
    if (fs.existsSync(requestExamplePath)) {
      try {
        examples[key] = JSON.parse(fs.readFileSync(requestExamplePath, 'utf8'));
      } catch (e) {
        warnings.push(`${file.replace(/\.md$/, '.example.json')}: JSON inválido (${e.message}) — exemplo ignorado.`);
      }
    }
    const baseName = path.basename(base);
    for (const f of fs.readdirSync(opsDir)) {
      const m = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.response-(\\d{3})\\.example\\.json$`).exec(f);
      if (!m) continue;
      try {
        responseExamples[key] = responseExamples[key] || {};
        responseExamples[key][m[1]] = JSON.parse(fs.readFileSync(path.join(opsDir, f), 'utf8'));
      } catch (e) {
        warnings.push(`operations/${f}: JSON inválido (${e.message}) — exemplo de resposta ignorado.`);
      }
    }
  }

  if (fs.existsSync(opsDir)) {
    for (const f of fs.readdirSync(opsDir)) {
      if (!f.endsWith('.example.json') || f.startsWith('_')) continue;
      const mdName = f.replace(/(\.response-\d{3})?\.example\.json$/, '.md');
      if (!fs.existsSync(path.join(opsDir, mdName))) {
        warnings.push(`operations/${f}: arquivo "${mdName}" correspondente não encontrado — exemplo ignorado.`);
      }
    }
  }

  const security = {};
  for (const { file, full } of listMd('security')) {
    const { data, body, error } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
    if (error) { warnings.push(`${file}: ${error} — ignorado.`); continue; }
    if (!data || !data.scheme) {
      warnings.push(`${file}: sem "scheme:" no frontmatter — ignorado.`);
      continue;
    }
    if (data.renameTo) warnings.push(`${file}: "renameTo" em security schemes não é suportado e será ignorado.`);
    if (security[data.scheme]) warnings.push(`${file}: scheme "${data.scheme}" já definido em outro arquivo — este sobrescreve.`);
    if (body) security[data.scheme] = { description: body };
  }

  const nonEmpty = (obj) => (Object.keys(obj).length > 0 ? obj : null);
  return {
    overview,
    info,
    tags: nonEmpty(tags),
    operations: nonEmpty(operations),
    examples: nonEmpty(examples),
    responseExamples: nonEmpty(responseExamples),
    security: nonEmpty(security),
    warnings,
  };
}

// --- Resolução de Configurações ---

/**
 * Resolve a propriedade `securityScheme: 'auto'` a partir dos esquemas declarados no spec.
 * Dispara um erro caso haja zero ou múltiplos esquemas do tipo HTTP bearer.
 */
export function resolveSecurityScheme(api, spec) {
  if (api.securityScheme !== 'auto') return api.securityScheme ?? null;

  const schemes = spec.components?.securitySchemes || {};
  const bearerNames = Object.entries(schemes)
    .filter(([, s]) => s && s.type === 'http' && String(s.scheme).toLowerCase() === 'bearer')
    .map(([name]) => name);

  if (bearerNames.length === 1) return bearerNames[0];

  const available = Object.keys(schemes);
  throw new Error(
    `API "${api.id}": não foi possível resolver securityScheme 'auto'. ` +
      (bearerNames.length === 0
        ? `Nenhum esquema HTTP bearer encontrado no spec.`
        : `Múltiplos esquemas bearer encontrados (${bearerNames.join(', ')}).`) +
      ` Disponíveis: ${available.length ? available.join(', ') : '(nenhum)'}. ` +
      `Defina o nome exato em apis.config.js.`
  );
}

/** Retorna as propriedades resolvidas da API para o consumo da aplicação. */
export function resolveApi(api, spec, environment) {
  const resolved = {
    id: api.id,
    title: api.title,
    slug: api.slug,
    isAuthProvider: Boolean(api.isAuthProvider),
    serverUrl: getServerUrl(api, environment),
    default: Boolean(api.default),
  };
  if (api.securitySchemes) resolved.securitySchemes = api.securitySchemes;
  else resolved.securityScheme = resolveSecurityScheme(api, spec);
  if (api.tokenResponseField) resolved.tokenResponseField = api.tokenResponseField;
  return resolved;
}

/** Gera a estrutura final de configuração do portal (public/portal.config.json). */
export function generatePortalConfig(resolvedApis, environment) {
  return {
    environment,
    sharedTokenVariable: SHARED_TOKEN_VARIABLE,
    apis: resolvedApis,
  };
}

export function buildAll(root = ROOT) {
  const errors = validateManifest();
  if (errors.length > 0) {
    for (const error of errors) console.error(`[build-content] ERRO: ${error}`);
    process.exit(1);
  }

  const environment = resolveEnvironment();
  console.log(`[build-content] ambiente: ${environment}`);

  const outDir = path.join(root, 'public', 'openapi');
  fs.mkdirSync(outDir, { recursive: true });

  const resolvedApis = [];
  let built = 0;
  for (const api of apis) {
    const basePath = path.join(root, 'src', 'base', `openapi-${api.id}.json`);
    if (!fs.existsSync(basePath)) {
      console.error(`[build-content] (${api.id}) spec bruto não encontrado em ${basePath}. Rode \`npm run api:fetch\` primeiro.`);
      process.exit(1);
    }

    const spec = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    const content = loadContent(api.id, root);

    for (const warning of content.warnings) console.warn(`[build-content] (${api.id}) AVISO: ${warning}`);
    for (const warning of findOrphanOverrides(spec, content)) console.warn(`[build-content] (${api.id}) AVISO: ${warning}`);

    let resolved;
    try {
      resolved = resolveApi(api, spec, environment);
    } catch (error) {
      console.error(`[build-content] ERRO: ${error.message}`);
      process.exit(1);
    }
    if (resolved.securityScheme && api.securityScheme === 'auto') {
      console.log(`[build-content] (${api.id}) securityScheme resolvido automaticamente: "${resolved.securityScheme}"`);
    }
    resolvedApis.push(resolved);

    const finalSpec = transformSpec(spec, content, { serverUrl: resolved.serverUrl });
    const outPath = path.join(outDir, `${api.id}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(finalSpec, null, 2)}\n`);
    console.log(`[build-content] ✅ ${api.id} → ${path.relative(root, outPath)}`);
    built += 1;
  }

  const portalConfig = generatePortalConfig(resolvedApis, environment);
  const portalConfigPath = path.join(root, 'public', 'portal.config.json');
  fs.writeFileSync(portalConfigPath, `${JSON.stringify(portalConfig, null, 2)}\n`);
  console.log(`[build-content] ✅ portal.config.json (${environment})`);

  console.log(`[build-content] ${built} spec(s) final(is) gerado(s).`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) buildAll();