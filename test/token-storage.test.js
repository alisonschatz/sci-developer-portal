import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  authStorageKey,
  readAuthEntry,
  writeTokenToScheme,
  getTokenStorageTargets,
  syncTokenToStorage,
  getMultiSchemeDocuments,
  ensureDocumentSelectedSchemes,
  ensureAllMultiSchemeSelections,
  mergeTokenIntoSerializedEntry,
  installTokenStorageGuard,
} from '../src/plugins/token-storage.js';

const portalConfig = JSON.parse(fs.readFileSync('test/fixtures/portal.config.fixture.json', 'utf8'));
const TARGETS = getTokenStorageTargets(portalConfig.apis);
const MULTI = getMultiSchemeDocuments(portalConfig.apis);

function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('authStorageKey monta a mesma chave que o Scalar usa', () => {
  assert.equal(authStorageKey('auth'), 'scalar-reference-auth-auth');
});

test('readAuthEntry: chave ausente ou corrompida volta vazio no formato certo, sem lançar', () => {
  assert.deepEqual(readAuthEntry(createFakeStorage(), 'auth'), { secrets: {}, selected: {} });
  assert.deepEqual(readAuthEntry(createFakeStorage({ 'scalar-reference-auth-auth': '{quebrado' }), 'auth'), { secrets: {}, selected: {} });
});

test('writeTokenToScheme preserva credenciais do Basic e o selected intocado', () => {
  const storage = createFakeStorage({
    'scalar-reference-auth-auth': JSON.stringify({
      secrets: { 'Gerar JWT': { type: 'http', 'x-scalar-secret-username': 'u', 'x-scalar-secret-password': 'p' } },
      selected: { document: { selectedIndex: 0, selectedSchemes: [{ 'Gerar JWT': [] }] } },
    }),
  });
  writeTokenToScheme(storage, 'auth', 'Atualizar JWT', 'novo');
  const saved = JSON.parse(storage.getItem('scalar-reference-auth-auth'));
  assert.equal(saved.secrets['Gerar JWT']['x-scalar-secret-username'], 'u');
  assert.equal(saved.secrets['Atualizar JWT']['x-scalar-secret-token'], 'novo');
  assert.deepEqual(saved.selected, { document: { selectedIndex: 0, selectedSchemes: [{ 'Gerar JWT': [] }] } });
});

test('getTokenStorageTargets do config resolvido: auth→"Atualizar JWT", rhnetsocial→"bearerAuth", nunca "Gerar JWT"', () => {
  assert.ok(TARGETS.some((t) => t.slug === 'auth' && t.schemeName === 'Atualizar JWT'));
  assert.ok(TARGETS.some((t) => t.slug === 'rhnetsocial' && t.schemeName === 'bearerAuth'));
  assert.equal(TARGETS.some((t) => t.schemeName === 'Gerar JWT'), false);
});

test('syncTokenToStorage grava em todos os alvos; não lança sem storage/token/targets', () => {
  const storage = createFakeStorage();
  syncTokenToStorage(storage, 'jwt', TARGETS);
  assert.equal(JSON.parse(storage.getItem('scalar-reference-auth-auth')).secrets['Atualizar JWT']['x-scalar-secret-token'], 'jwt');
  assert.equal(JSON.parse(storage.getItem('scalar-reference-auth-rhnetsocial')).secrets.bearerAuth['x-scalar-secret-token'], 'jwt');
  assert.doesNotThrow(() => syncTokenToStorage(undefined, 'x', TARGETS));
  assert.doesNotThrow(() => syncTokenToStorage(storage, null, TARGETS));
  assert.doesNotThrow(() => syncTokenToStorage(storage, 'x', undefined));
});

test('getMultiSchemeDocuments: só a auth (2 schemes)', () => {
  assert.deepEqual(MULTI, [{ slug: 'auth', schemeNames: ['Gerar JWT', 'Atualizar JWT'] }]);
});

test('ensureDocumentSelectedSchemes: cria do zero, regenera vazio (clique acidental) e com só 1; não reescreve quando correto; nunca toca em secrets', () => {
  const s1 = createFakeStorage();
  ensureDocumentSelectedSchemes(s1, 'auth', ['Gerar JWT', 'Atualizar JWT']);
  assert.equal(JSON.parse(s1.getItem('scalar-reference-auth-auth')).selected.document.selectedSchemes.length, 2);

  const s2 = createFakeStorage({ 'scalar-reference-auth-auth': JSON.stringify({ secrets: { 'Gerar JWT': { 'x-scalar-secret-username': 'u' } }, selected: { document: { selectedIndex: 0, selectedSchemes: [] } } }) });
  ensureDocumentSelectedSchemes(s2, 'auth', ['Gerar JWT', 'Atualizar JWT']);
  const saved2 = JSON.parse(s2.getItem('scalar-reference-auth-auth'));
  assert.equal(saved2.selected.document.selectedSchemes.length, 2);
  assert.equal(saved2.secrets['Gerar JWT']['x-scalar-secret-username'], 'u');

  const original = JSON.stringify({ secrets: {}, selected: { document: { selectedIndex: 0, selectedSchemes: [{ 'Gerar JWT': [] }, { 'Atualizar JWT': [] }] } } });
  const s3 = createFakeStorage({ 'scalar-reference-auth-auth': original });
  ensureDocumentSelectedSchemes(s3, 'auth', ['Gerar JWT', 'Atualizar JWT']);
  assert.equal(s3.getItem('scalar-reference-auth-auth'), original);
});

test('ensureAllMultiSchemeSelections aplica em todos os documentos multi-scheme; não lança sem storage/lista', () => {
  assert.doesNotThrow(() => ensureAllMultiSchemeSelections(undefined, MULTI));
  assert.doesNotThrow(() => ensureAllMultiSchemeSelections(createFakeStorage(), undefined));
  const storage = createFakeStorage();
  ensureAllMultiSchemeSelections(storage, MULTI);
  assert.equal(JSON.parse(storage.getItem('scalar-reference-auth-auth')).selected.document.selectedSchemes.length, 2);
});

test('mergeTokenIntoSerializedEntry aplica preservando o resto; lida com valor ausente/corrompido', () => {
  const merged = JSON.parse(
    mergeTokenIntoSerializedEntry(
      JSON.stringify({ secrets: { 'Gerar JWT': { 'x-scalar-secret-username': 'u' } }, selected: { x: 1 } }),
      ['Atualizar JWT'],
      'tk'
    )
  );
  assert.equal(merged.secrets['Atualizar JWT']['x-scalar-secret-token'], 'tk');
  assert.equal(merged.secrets['Gerar JWT']['x-scalar-secret-username'], 'u');
  assert.deepEqual(merged.selected, { x: 1 });
  assert.doesNotThrow(() => mergeTokenIntoSerializedEntry(null, ['A'], 'x'));
  assert.doesNotThrow(() => mergeTokenIntoSerializedEntry('{quebrado', ['A'], 'x'));
});

test('installTokenStorageGuard: reaplica o token quando o Scalar escreve por cima (a corrida real); chaves fora do alvo intocadas; idempotente; desinstala; limpa flag da v1', () => {
  const storage = createFakeStorage({ __tokenBridgeGuardInstalled: 'true' });
  const state = { token: null };

  const uninstall = installTokenStorageGuard(storage, state, TARGETS);
  assert.equal(storage.getItem('__tokenBridgeGuardInstalled'), null, 'flag da v1 limpa');

  state.token = 'tk';
  // Scalar escreve por cima, sem saber do token (autosave debounced)
  storage.setItem('scalar-reference-auth-auth', JSON.stringify({ secrets: { 'Gerar JWT': { 'x-scalar-secret-username': 'u' } }, selected: {} }));
  const saved = JSON.parse(storage.getItem('scalar-reference-auth-auth'));
  assert.equal(saved.secrets['Atualizar JWT']['x-scalar-secret-token'], 'tk');
  assert.equal(saved.secrets['Gerar JWT']['x-scalar-secret-username'], 'u');

  storage.setItem('colorMode', 'dark');
  assert.equal(storage.getItem('colorMode'), 'dark');

  const second = installTokenStorageGuard(storage, state, TARGETS); // no-op
  assert.equal(typeof second, 'function');

  uninstall();
  storage.setItem('scalar-reference-auth-auth', JSON.stringify({ secrets: {}, selected: {} }));
  assert.equal('Atualizar JWT' in JSON.parse(storage.getItem('scalar-reference-auth-auth')).secrets, false);
});
