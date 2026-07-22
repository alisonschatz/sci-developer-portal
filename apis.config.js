/**
 * Configuração central das APIs declaradas no portal.
 *
 * @typedef {object} ApiEntry
 * @property {string} id Identificador único em kebab-case.
 * @property {string} title Nome exibido na interface.
 * @property {string} slug Slug para composição de URLs e chaves de armazenamento.
 * @property {boolean} isAuthProvider Identifica se a API é a provedora do token de autenticação.
 * @property {string} [docsPath] Caminho do spec OpenAPI no servidor (padrão: DOCS_PATH_DEFAULT).
 * @property {string|null} [securityScheme] Esquema de segurança ('auto' para resolução automática ou o nome exato).
 * @property {Array<{name: string, prefill?: object}>} [securitySchemes] Lista explícita de esquemas de segurança.
 * @property {string} [tokenResponseField] Campo da resposta JSON que contém o token de autenticação.
 * @property {boolean} [default] Define a API padrão exibida ao carregar o portal.
 */

export const SHARED_TOKEN_VARIABLE = 'sci_auth_token';
export const DOCS_PATH_DEFAULT = '/docs?api-docs.json';
export const ENVIRONMENTS = ['production', 'homolog'];

/** @type {ApiEntry[]} */
export const apis = [
  {
    id: 'auth',
    title: 'Autenticação',
    slug: 'auth',
    isAuthProvider: true,
    securityScheme: null,
    securitySchemes: [
      { name: 'Gerar JWT' },
      { name: 'Atualizar JWT', prefill: { token: `{{${SHARED_TOKEN_VARIABLE}}}` } },
    ],
    tokenResponseField: 'token',
    default: true,
  },
  {
    id: 'rhnetsocial',
    title: 'RH Net Social',
    slug: 'rhnetsocial',
    isAuthProvider: false,
    securityScheme: 'auto',
    default: false,
  },

  // ── Próxima API entra aqui (npm run api:new) ─────────────────────────
];

export function getAuthProvider() {
  return apis.find((api) => api.isAuthProvider);
}

/** Retorna o nome da variável de ambiente que contém a URL base da API. */
export function serverEnvVarName(apiId, environment = 'production') {
  const prefix = apiId.toUpperCase().replace(/-/g, '_');
  return environment === 'homolog' ? `${prefix}_SERVER_URL_HML` : `${prefix}_SERVER_URL`;
}

/** Retorna a URL base do servidor da API para o ambiente especificado. */
export function getServerUrl(api, environment = 'production', env = process.env) {
  const varName = serverEnvVarName(api.id, environment);
  const url = env[varName];
  if (!url) {
    throw new Error(
      `API "${api.id}": variável de ambiente ${varName} não definida.`
    );
  }
  return url.replace(/\/$/, '');
}

/** Retorna a URL completa para obtenção da especificação OpenAPI. */
export function getDocsUrl(api, environment = 'production', env = process.env) {
  return `${getServerUrl(api, environment, env)}${api.docsPath || DOCS_PATH_DEFAULT}`;
}

/** Valida a integridade das configurações declaradas no manifesto de APIs. */
export function validateManifest(entries = apis) {
  const errors = [];
  if (!Array.isArray(entries) || entries.length === 0) return ['O manifesto precisa ter pelo menos uma API.'];

  const ids = new Set();
  const slugs = new Set();
  let authProviderCount = 0;
  let defaultCount = 0;

  for (const api of entries) {
    if (!api.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(api.id)) errors.push(`API com id inválido (esperado kebab-case): "${api.id}".`);
    if (ids.has(api.id)) errors.push(`id duplicado: "${api.id}".`);
    ids.add(api.id);

    if (!api.slug) errors.push(`API "${api.id}" não define slug.`);
    if (slugs.has(api.slug)) errors.push(`slug duplicado: "${api.slug}".`);
    slugs.add(api.slug);

    if (api.isAuthProvider) {
      authProviderCount += 1;
      if (!api.tokenResponseField) errors.push(`API "${api.id}" é isAuthProvider mas não define tokenResponseField.`);
    }
    if (api.default) defaultCount += 1;

    if (api.securityScheme && api.securityScheme !== 'auto' && api.securitySchemes) {
      errors.push(`API "${api.id}" define securityScheme E securitySchemes — use só um.`);
    }
    if (api.securitySchemes) {
      if (!Array.isArray(api.securitySchemes) || api.securitySchemes.length === 0) {
        errors.push(`API "${api.id}": securitySchemes precisa ser um array não-vazio.`);
      } else {
        for (const scheme of api.securitySchemes) {
          if (!scheme.name) errors.push(`API "${api.id}": entrada de securitySchemes sem "name".`);
          if (scheme.name === 'auto') errors.push(`API "${api.id}": 'auto' não é válido dentro de securitySchemes.`);
        }
      }
    }
    if (!api.isAuthProvider && !api.securityScheme && !api.securitySchemes) {
      errors.push(`API "${api.id}" não define securityScheme nem securitySchemes.`);
    }
  }

  if (authProviderCount !== 1) errors.push(`Esperada exatamente 1 API com isAuthProvider: true — encontradas ${authProviderCount}.`);
  if (defaultCount !== 1) errors.push(`Esperada exatamente 1 API com default: true — encontradas ${defaultCount}.`);
  return errors;
}