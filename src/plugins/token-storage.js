/**
 * Utilitários para persistência e sincronização de credenciais de autenticação
 * no armazenamento local (localStorage) utilizado pelo Scalar.
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

/** Retorna a lista de alvos (slug e nome do esquema) que recebem o token. */
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
      // Trata eventuais falhas sem interromper o fluxo
    }
  }
}

/** Retorna os documentos que possuem múltiplos esquemas de segurança. */
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

/** Garante a seleção dos esquemas configurados nos documentos com múltiplos esquemas. */
export function ensureAllMultiSchemeSelections(storage, multiSchemeDocuments) {
  if (!storage || !Array.isArray(multiSchemeDocuments)) return;
  for (const { slug, schemeNames } of multiSchemeDocuments) {
    try {
      ensureDocumentSelectedSchemes(storage, slug, schemeNames);
    } catch {
      // Trata falhas na configuração inicial dos esquemas
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

const guardedStorages = new WeakSet();

/**
 * Intercepta o método `storage.setItem` para reaplicar o token de autenticação
 * atualizado sempre que houver persistência nas chaves de autenticação do Scalar.
 */
export function installTokenStorageGuard(storage, state, targets) {
  if (!storage || typeof storage.setItem !== 'function' || guardedStorages.has(storage)) {
    return () => {};
  }

  try {
    if (typeof storage.removeItem === 'function') storage.removeItem('__tokenBridgeGuardInstalled');
  } catch {
    // Trata remoção de chaves legadas
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