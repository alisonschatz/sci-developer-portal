import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getBearerTokenConsumerServers,
  matchesAnyServer,
  needsBearerPatch,
  extractToken,
  createSciTokenClientPlugin,
  createSciPortalPlugin,
} from '../src/plugins/sci-token-plugin.js';

const portalConfig = JSON.parse(fs.readFileSync('test/fixtures/portal.config.fixture.json', 'utf8'));

function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('getBearerTokenConsumerServers inclui RH Net Social E a auth (Atualizar JWT tem prefill)', () => {
  const servers = getBearerTokenConsumerServers(portalConfig);
  assert.ok(servers.includes('https://api2.rhnetsocial.com.br'));
  assert.ok(servers.includes('https://api-auth.sci.com.br'));
});

test('matchesAnyServer / needsBearerPatch / extractToken — regras puras', () => {
  assert.equal(matchesAnyServer('https://api2.rhnetsocial.com.br/x', ['https://api2.rhnetsocial.com.br']), true);
  assert.equal(matchesAnyServer(null, ['https://x']), false);
  const p = '{{sci_auth_token}}';
  assert.equal(needsBearerPatch(null, p), true);
  assert.equal(needsBearerPatch('Bearer {{sci_auth_token}}', p), true);
  assert.equal(needsBearerPatch('Bearer real', p), false);
  assert.equal(needsBearerPatch('Basic abc', p), false);
  assert.equal(extractToken({ token: 'abc' }, 'token'), 'abc');
  assert.equal(extractToken({ token: 42 }, 'token'), null);
});

test('fluxo completo pelos hooks: responseReceived captura; beforeRequest injeta na seguinte', async () => {
  const storage = createFakeStorage();
  const { clientPlugin, state } = createSciTokenClientPlugin({ portalConfig, storage });

  const login = new Response(JSON.stringify({ token: 'jwt-123' }), { status: 201 });
  Object.defineProperty(login, 'url', { value: 'https://api-auth.sci.com.br/api/v1/auth/credencial/login' });
  clientPlugin.hooks.responseReceived({ response: login });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(state.token, 'jwt-123');
  assert.equal(
    JSON.parse(storage.getItem('scalar-reference-auth-auth')).secrets['Atualizar JWT']['x-scalar-secret-token'],
    'jwt-123'
  );
  assert.equal(
    JSON.parse(storage.getItem('scalar-reference-auth-rhnetsocial')).secrets.bearerAuth['x-scalar-secret-token'],
    'jwt-123'
  );

  const req = new Request('https://api2.rhnetsocial.com.br/api/v1/feriados', {
    headers: { Authorization: 'Bearer {{sci_auth_token}}', Accept: 'application/json' },
  });
  clientPlugin.hooks.beforeRequest({ requestBuilder: req });
  assert.equal(req.headers.get('Authorization'), 'Bearer jwt-123');
  assert.equal(req.headers.get('Accept'), 'application/json');
});

test('refresh (Bearer) da própria auth é corrigido; login (Basic) nunca é tocado; fora do manifesto ignorado', () => {
  const { clientPlugin, state } = createSciTokenClientPlugin({ portalConfig, storage: createFakeStorage() });
  state.token = 'tk';

  const login = new Request('https://api-auth.sci.com.br/api/v1/auth/credencial/login', { headers: { Authorization: 'Basic abc' } });
  clientPlugin.hooks.beforeRequest({ requestBuilder: login });
  assert.equal(login.headers.get('Authorization'), 'Basic abc');

  const refresh = new Request('https://api-auth.sci.com.br/api/v1/auth/refresh', { headers: { Authorization: 'Bearer {{sci_auth_token}}' } });
  clientPlugin.hooks.beforeRequest({ requestBuilder: refresh });
  assert.equal(refresh.headers.get('Authorization'), 'Bearer tk');

  const fora = new Request('https://portal.sci.com.br/openapi/auth.json');
  clientPlugin.hooks.beforeRequest({ requestBuilder: fora });
  assert.equal(fora.headers.get('Authorization'), null);
});

test('responseReceived ignora erro HTTP e outros servers; hooks nunca lançam com payload malformado', async () => {
  const { clientPlugin, state } = createSciTokenClientPlugin({ portalConfig, storage: createFakeStorage() });

  const err = new Response('{"token":"x"}', { status: 401 });
  Object.defineProperty(err, 'url', { value: 'https://api-auth.sci.com.br/login' });
  clientPlugin.hooks.responseReceived({ response: err });

  const outro = new Response('{"token":"y"}', { status: 200 });
  Object.defineProperty(outro, 'url', { value: 'https://outra.com/login' });
  clientPlugin.hooks.responseReceived({ response: outro });

  await new Promise((r) => setTimeout(r, 0));
  assert.equal(state.token, null);

  assert.doesNotThrow(() => clientPlugin.hooks.beforeRequest({ requestBuilder: null }));
  assert.doesNotThrow(() => clientPlugin.hooks.responseReceived({}));
});

test('createSciPortalPlugin no formato documentado de ApiReferencePlugin', () => {
  const { plugin } = createSciPortalPlugin({ portalConfig, storage: createFakeStorage() });
  const resolved = plugin()();
  assert.equal(resolved.name, 'sci-portal-token');
  assert.equal(resolved.apiClientPlugins.length, 1);
  assert.equal(typeof resolved.apiClientPlugins[0].hooks.beforeRequest, 'function');
});
