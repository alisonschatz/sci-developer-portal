import { syncTokenToStorage, getTokenStorageTargets } from './token-storage.js';

/**
 * Plugin de token compartilhado — API OFICIAL de plugins do Scalar
 * (ClientPlugin hooks beforeRequest/responseReceived), parametrizado
 * pelo portal.config.json resolvido (nada de importar o manifesto:
 * autoria e runtime são camadas separadas).
 *
 * - responseReceived: captura o JWT de respostas OK do server da Auth.
 * - beforeRequest: injeta `Authorization: Bearer <token>` nas chamadas
 *   às APIs consumidoras — só se o header estiver ausente/vazio/com o
 *   placeholder não resolvido; valor manual nunca é sobrescrito.
 */

const AUTH_HEADER = 'Authorization';

/** Servers que recebem o token via Bearer — derivado do config resolvido.
 *  Inclui a própria Auth quando algum scheme dela tem prefill de token. */
export function getBearerTokenConsumerServers(portalConfig) {
  const servers = [];
  for (const api of portalConfig.apis) {
    if (api.securityScheme) servers.push(api.serverUrl);
    else if (api.securitySchemes) {
      if (api.securitySchemes.some((s) => s.prefill && 'token' in s.prefill)) servers.push(api.serverUrl);
    }
  }
  return servers;
}

export function matchesAnyServer(url, servers) {
  if (!url) return false;
  return servers.some((server) => url.startsWith(server));
}

export function needsBearerPatch(existingHeader, placeholder) {
  if (!existingHeader) return true;
  const trimmed = existingHeader.trim();
  if (trimmed === '' || trimmed === 'Bearer' || trimmed === 'Bearer ') return true;
  if (trimmed.includes(placeholder)) return true;
  return false;
}

export function extractToken(body, field) {
  const value = body && field ? body[field] : undefined;
  return typeof value === 'string' && value ? value : null;
}

export function createSciTokenClientPlugin({
  portalConfig,
  state = { token: null },
  storage = typeof window !== 'undefined' ? window.localStorage : undefined,
}) {
  const provider = portalConfig.apis.find((api) => api.isAuthProvider);
  const bearerConsumerServers = getBearerTokenConsumerServers(portalConfig);
  const placeholder = `{{${portalConfig.sharedTokenVariable}}}`;
  const storageTargets = getTokenStorageTargets(portalConfig.apis);

  const clientPlugin = {
    hooks: {
      beforeRequest: ({ requestBuilder }) => {
        try {
          if (!state.token) return;
          const url = typeof requestBuilder?.url === 'string' ? requestBuilder.url : null;
          if (!matchesAnyServer(url, bearerConsumerServers)) return;
          const existing =
            requestBuilder.headers && typeof requestBuilder.headers.get === 'function'
              ? requestBuilder.headers.get(AUTH_HEADER)
              : null;
          if (needsBearerPatch(existing, placeholder)) {
            requestBuilder.headers.set(AUTH_HEADER, `Bearer ${state.token}`);
          }
        } catch {
          /* nunca quebra uma requisição de verdade */
        }
      },

      responseReceived: ({ response }) => {
        try {
          const url = typeof response?.url === 'string' ? response.url : null;
          if (!url || !provider || !url.startsWith(provider.serverUrl) || !response.ok) return;
          response
            .clone()
            .json()
            .then((body) => {
              const token = extractToken(body, provider.tokenResponseField);
              if (token) {
                state.token = token;
                syncTokenToStorage(storage, token, storageTargets);
              }
            })
            .catch(() => {});
        } catch {
          /* nunca quebra o fluxo de resposta */
        }
      },
    },
  };

  return { clientPlugin, state };
}

/** ApiReferencePlugin (formato documentado) que embrulha o ClientPlugin
 *  acima — é ESTE que entra em configuration.plugins. */
export function createSciPortalPlugin(options) {
  const { clientPlugin, state } = createSciTokenClientPlugin(options);
  const plugin = () => () => ({
    name: 'sci-portal-token',
    extensions: [],
    apiClientPlugins: [clientPlugin],
  });
  return { plugin, state };
}
