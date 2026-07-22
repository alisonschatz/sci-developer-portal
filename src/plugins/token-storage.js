/**
 * Escrita direta na persistência de auth do Scalar (localStorage) —
 * confirmado no código-fonte deles:
 *   chave:   `scalar-reference-auth-<slug>`
 *   formato: secrets[scheme] = { type: 'http', 'x-scalar-secret-token',
 *            'x-scalar-secret-username', 'x-scalar-secret-password' }
 *   selected.document = { selectedIndex, selectedSchemes }
 *
 * Por quê: o Scalar só RELÊ essa chave ao ativar um documento (trocar
 * de aba/recarregar) — escrever aqui faz o campo aparecer preenchido de
 * verdade na próxima ativação. O guard no setItem cobre a corrida com o
 * autosave interno do Scalar (que senão apagava o token). Tudo
 * parametrizado pelo portal.config.json resolvido — este módulo não
 * importa o manifesto de autoria.
 */

const AUTH_KEY_PREFIX = 'scalar-reference-auth';

export function authStorageKey(slug) {
  return `${AUTH_KEY_PREFIX}-${slug}`;
}

export function readAuthEntry(storage, slug) {
  try {
    const raw = storage.getItem(authStorageKey(slug));
    if (!raw) return { secrets: {}, selected: {} };
    const parsed = JSON.parse(raw);
    return {
      secrets: parsed && typeof parsed.secrets === 'object' ? parsed.secrets : {},
      selected: parsed && typeof parsed.selected === 'object' ? parsed.selected : {},
    };
  } catch {
    return { secrets: {}, selected: {} };
  }
}

export function writeTokenToScheme(storage, slug, schemeName, token) {
  const entry = readAuthEntry(storage, slug);
  const existingScheme = entry.secrets[schemeName] || { type: 'http' };
  const updated = {
    ...entry,
    secrets: { ...entry.secrets, [schemeName]: { ...existingScheme, 'x-scalar-secret-token': token } },
  };
  storage.setItem(authStorageKey(slug), JSON.stringify(updated));
}

/** (slug, schemeName) que recebem o token — derivado das APIs RESOLVIDAS. */
export function getTokenStorageTargets(resolvedApis) {
  const targets = [];
  for (const api of resolvedApis) {
    if (api.securityScheme) {
      targets.push({ slug: api.slug, schemeName: api.securityScheme });
    } else if (api.securitySchemes) {
      for (const scheme of api.securitySchemes) {
        if (scheme.prefill && 'token' in scheme.prefill) targets.push({ slug: api.slug, schemeName: scheme.name });
      }
    }
  }
  return targets;
}

export function syncTokenToStorage(storage, token, targets) {
  if (!storage || !token || !Array.isArray(targets)) return;
  for (const { slug, schemeName } of targets) {
    try {
      writeTokenToScheme(storage, slug, schemeName, token);
    } catch {
      /* complemento, não crítico */
    }
  }
}

/** Documentos com mais de 1 scheme (hoje, só a Auth). */
export function getMultiSchemeDocuments(resolvedApis) {
  return resolvedApis
    .filter((api) => Array.isArray(api.securitySchemes) && api.securitySchemes.length > 1)
    .map((api) => ({ slug: api.slug, schemeNames: api.securitySchemes.map((s) => s.name) }));
}

function hasAllSchemesSelected(selectedSchemes, schemeNames) {
  if (!Array.isArray(selectedSchemes)) return false;
  return schemeNames.every((name) => selectedSchemes.some((req) => req && name in req));
}

export function ensureDocumentSelectedSchemes(storage, slug, schemeNames) {
  const entry = readAuthEntry(storage, slug);
  const existing = entry.selected.document;
  if (existing && hasAllSchemesSelected(existing.selectedSchemes, schemeNames)) return;
  const updated = {
    ...entry,
    selected: {
      ...entry.selected,
      document: { selectedIndex: 0, selectedSchemes: schemeNames.map((name) => ({ [name]: [] })) },
    },
  };
  storage.setItem(authStorageKey(slug), JSON.stringify(updated));
}

/** Autocura a cada carga da página: o topo do documento Auth sempre com
 *  os dois schemes disponíveis (trade-off decidido — ver arquitetura). */
export function ensureAllMultiSchemeSelections(storage, multiSchemeDocuments) {
  if (!storage || !Array.isArray(multiSchemeDocuments)) return;
  for (const { slug, schemeNames } of multiSchemeDocuments) {
    try {
      ensureDocumentSelectedSchemes(storage, slug, schemeNames);
    } catch {
      /* nunca impede o app de montar */
    }
  }
}

export function mergeTokenIntoSerializedEntry(rawValue, schemeNames, token) {
  let entry;
  try {
    const parsed = rawValue ? JSON.parse(rawValue) : null;
    entry = {
      secrets: parsed && typeof parsed.secrets === 'object' ? parsed.secrets : {},
      selected: parsed && typeof parsed.selected === 'object' ? parsed.selected : {},
    };
  } catch {
    entry = { secrets: {}, selected: {} };
  }
  const secrets = { ...entry.secrets };
  for (const schemeName of schemeNames) {
    const existingScheme = secrets[schemeName] || { type: 'http' };
    secrets[schemeName] = { ...existingScheme, 'x-scalar-secret-token': token };
  }
  return JSON.stringify({ ...entry, secrets });
}

/** Flag de idempotência em memória (WeakSet) — NUNCA uma propriedade no
 *  storage: num navegador real, `storage.prop = x` vira uma entrada de
 *  verdade e sobrevive a reload (bug real da v1). */
const guardedStorages = new WeakSet();

/**
 * Intercepta storage.setItem: depois de QUALQUER escrita nas chaves de
 * auth relevantes (inclusive o autosave debounced do próprio Scalar,
 * que não sabe do nosso token), reaplica o token por cima na hora.
 */
export function installTokenStorageGuard(storage, state, targets) {
  if (!storage || typeof storage.setItem !== 'function' || guardedStorages.has(storage)) {
    return () => {};
  }

  try {
    if (typeof storage.removeItem === 'function') storage.removeItem('__tokenBridgeGuardInstalled'); // limpeza v1
  } catch {
    /* cortesia */
  }

  const originalSetItem = storage.setItem.bind(storage);
  const targetsByKey = new Map();
  for (const { slug, schemeName } of targets || []) {
    const key = authStorageKey(slug);
    if (!targetsByKey.has(key)) targetsByKey.set(key, []);
    targetsByKey.get(key).push(schemeName);
  }

  function guardedSetItem(key, value) {
    if (state.token && targetsByKey.has(key)) {
      originalSetItem(key, mergeTokenIntoSerializedEntry(value, targetsByKey.get(key), state.token));
      return;
    }
    originalSetItem(key, value);
  }

  storage.setItem = guardedSetItem;
  guardedStorages.add(storage);

  return function uninstall() {
    storage.setItem = originalSetItem;
    guardedStorages.delete(storage);
  };
}
