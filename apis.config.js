/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  FONTE ÚNICA DA VERDADE DO PORTAL                                    ║
 * ║                                                                      ║
 * ║  Toda API é declarada aqui, e SÓ aqui. O build resolve o resto       ║
 * ║  (URLs de docs, security schemes) automaticamente e gera             ║
 * ║  public/portal.config.json — o contrato que o frontend consome.      ║
 * ║                                                                      ║
 * ║  API nova:  npm run api:new -- <id> "<Título>"                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * @typedef {object} ApiEntry
 * @property {string} id            kebab-case (vira nome de arquivo).
 * @property {string} title         Nome exibido no portal.
 * @property {string} slug          Slug de URL/storage. Normalmente = id.
 * @property {boolean} isAuthProvider  true SÓ na API que gera o token.
 *   (As URLs base por ambiente NÃO ficam aqui — vêm de variáveis de
 *   ambiente derivadas do id: <ID>_SERVER_URL e <ID>_SERVER_URL_HML.
 *   O spec é baixado de `<serverUrl><docsPath>`. Ver serverEnvVarName.)
 * @property {string} [docsPath]    Caminho do spec no server (padrão:
 *                                  DOCS_PATH_DEFAULT). Só defina se a API
 *                                  fugir do padrão da SCI.
 * @property {string|null} [securityScheme]
 *                                  'auto' (padrão recomendado): o build lê
 *                                  components.securitySchemes do spec baixado
 *                                  e resolve sozinho — exatamente 1 scheme
 *                                  HTTP bearer → usa; 0 ou vários → o build
 *                                  FALHA com os nomes disponíveis, pra você
 *                                  fixar explicitamente. Ou o nome exato.
 * @property {Array<{name: string, prefill?: object}>} [securitySchemes]
 *                                  Caso rico (hoje, só a auth) — nomes
 *                                  explícitos, nunca 'auto'.
 * @property {string} [tokenResponseField]  Só no auth provider: campo do JSON
 *                                  de resposta que contém o JWT.
 * @property {boolean} [default]    true na API que abre por padrão.
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
      { name: 'Gerar JWT' }, // HTTP Basic — tokens de parceiro/cliente
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

/** Nome da variável de ambiente do server da API no ambiente dado —
 *  DERIVADO do id, nunca declarado: "rhnetsocial" → RHNETSOCIAL_SERVER_URL
 *  (produção) / RHNETSOCIAL_SERVER_URL_HML (homologação). As URLs vivem
 *  fora do código (.env local / secrets no CI) por segurança. */
export function serverEnvVarName(apiId, environment = 'production') {
  const prefix = apiId.toUpperCase().replace(/-/g, '_');
  return environment === 'homolog' ? `${prefix}_SERVER_URL_HML` : `${prefix}_SERVER_URL`;
}

/** URL base da API no ambiente. Lança citando a variável exata se ausente. */
export function getServerUrl(api, environment = 'production', env = process.env) {
  const varName = serverEnvVarName(api.id, environment);
  const url = env[varName];
  if (!url) {
    throw new Error(
      `API "${api.id}": variável de ambiente ${varName} não definida. ` +
        `Local: copie .env.example para .env (npm run env:example regenera). CI: configure como secret.`
    );
  }
  return url.replace(/\/$/, '');
}

/** URL do spec OpenAPI — sempre derivada do server, nunca configurada à parte. */
export function getDocsUrl(api, environment = 'production', env = process.env) {
  return `${getServerUrl(api, environment, env)}${api.docsPath || DOCS_PATH_DEFAULT}`;
}

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
          if (scheme.name === 'auto') errors.push(`API "${api.id}": 'auto' não vale dentro de securitySchemes — só no securityScheme simples.`);
        }
      }
    }
    if (!api.isAuthProvider && !api.securityScheme && !api.securitySchemes) {
      errors.push(`API "${api.id}" não define securityScheme ('auto' resolve sozinho) nem securitySchemes — o token compartilhado não seria plugado nela.`);
    }
  }

  if (authProviderCount !== 1) errors.push(`Esperada exatamente 1 API com isAuthProvider: true — encontradas ${authProviderCount}.`);
  if (defaultCount !== 1) errors.push(`Esperada exatamente 1 API com default: true — encontradas ${defaultCount}.`);
  return errors;
}
