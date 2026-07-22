import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apis,
  serverEnvVarName,
  getAuthProvider,
  validateManifest,
  getServerUrl,
  getDocsUrl,
  SHARED_TOKEN_VARIABLE,
  DOCS_PATH_DEFAULT,
} from '../apis.config.js';

test('o manifesto real é válido', () => {
  assert.deepEqual(validateManifest(), []);
});

test('getAuthProvider() encontra a auth, com tokenResponseField', () => {
  const p = getAuthProvider();
  assert.equal(p.id, 'auth');
  assert.equal(p.tokenResponseField, 'token');
});

test('getDocsUrl deriva a URL do spec da env var + docsPath padrão (não existe URL separada)', () => {
  const fakeEnv = { AUTH_SERVER_URL: 'https://api-auth.sci.com.br', X_SERVER_URL: 'https://x/' };
  const auth = apis.find((a) => a.id === 'auth');
  assert.equal(getDocsUrl(auth, 'production', fakeEnv), `https://api-auth.sci.com.br${DOCS_PATH_DEFAULT}`);
  assert.equal(getDocsUrl({ id: 'x', docsPath: '/openapi.json' }, 'production', fakeEnv), 'https://x/openapi.json');
});

test('serverEnvVarName deriva do id: kebab-case vira SNAKE, sufixo _HML em homolog', () => {
  assert.equal(serverEnvVarName('rhnetsocial'), 'RHNETSOCIAL_SERVER_URL');
  assert.equal(serverEnvVarName('nova-api', 'homolog'), 'NOVA_API_SERVER_URL_HML');
});

test('getServerUrl lança citando a variável exata quando ausente', () => {
  assert.throws(() => getServerUrl({ id: 'auth' }, 'homolog', {}), /AUTH_SERVER_URL_HML/);
  assert.throws(() => getServerUrl({ id: 'x' }, 'production', {}), /X_SERVER_URL/);
});

test('SHARED_TOKEN_VARIABLE definida', () => {
  assert.ok(SHARED_TOKEN_VARIABLE.length > 0);
});

test('validação: kebab-case, duplicatas, exatamente 1 auth provider e 1 default', () => {
  const base = { securityScheme: 'auto' };
  const errors = validateManifest([
    { ...base, id: 'Maiusculo', slug: 'a', isAuthProvider: true, tokenResponseField: 't', default: true },
    { ...base, id: 'dup', slug: 'dup' },
    { ...base, id: 'dup', slug: 'dup' },
  ]);
  assert.ok(errors.some((e) => e.includes('kebab-case')));
  assert.ok(errors.some((e) => e.includes('id duplicado')));
  assert.ok(errors.some((e) => e.includes('slug duplicado')));

  const semAuth = validateManifest([{ ...base, id: 'a', slug: 'a', default: true }]);
  assert.ok(semAuth.some((e) => e.includes('isAuthProvider')));
});

test('validação: "auto" proibido dentro de securitySchemes', () => {
  const authOk = { id: 'auth', slug: 'auth', isAuthProvider: true, tokenResponseField: 't', default: true, securitySchemes: [{ name: 'S' }] };
  const errors = validateManifest([
    authOk,
    { id: 'auto-errado', slug: 'auto-errado', securitySchemes: [{ name: 'auto' }] },
  ]);
  assert.ok(errors.some((e) => e.includes("'auto' não é válido dentro de securitySchemes")));
});

test('validação: API não-auth sem scheme nenhum é erro (token não seria plugado)', () => {
  const authOk = { id: 'auth', slug: 'auth', isAuthProvider: true, tokenResponseField: 't', default: true, securitySchemes: [{ name: 'S' }] };
  const errors = validateManifest([authOk, { id: 'x', slug: 'x' }]);
  assert.ok(errors.some((e) => e.includes('não define securityScheme nem securitySchemes')));
});

test('sanity: toda API real tem content/<id>/ com overview.md e as pastas', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  for (const api of apis) {
    const dir = path.join(process.cwd(), 'content', api.id);
    assert.ok(fs.existsSync(path.join(dir, 'overview.md')), `faltando: content/${api.id}/overview.md`);
    assert.ok(fs.existsSync(path.join(dir, 'tags')), `faltando: content/${api.id}/tags/`);
    assert.ok(fs.existsSync(path.join(dir, 'operations')), `faltando: content/${api.id}/operations/`);
  }
});