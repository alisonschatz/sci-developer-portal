import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { isBlacklisted, filterInternalRoutes, resolveEnvironment } from '../scripts/fetch.js';

test('isBlacklisted bloqueia rotas administrativas/internas/debug/health', () => {
  for (const route of ['/api/admin/usuarios', '/internal/config', '/debug/vars', '/health', '/healthcheck', '/metrics', '/swagger.json', '/docs']) {
    assert.equal(isBlacklisted(route), true, route);
  }
});

test('isBlacklisted NÃO bloqueia rotas de negócio legítimas', () => {
  for (const route of ['/api/v1/feriados', '/api/v1/auth/credencial/login', '/api/v1/administradora-de-beneficios']) {
    assert.equal(isBlacklisted(route), false, route);
  }
});

test('filterInternalRoutes remove só as rotas da blacklist', () => {
  const { spec, removed } = filterInternalRoutes({ paths: { '/api/v1/ok': {}, '/api/admin/nao': {}, '/health': {} } });
  assert.equal(removed, 2);
  assert.deepEqual(Object.keys(spec.paths), ['/api/v1/ok']);
});

test('resolveEnvironment: argumento CLI > PORTAL_ENV > production; inválido lança', () => {
  assert.equal(resolveEnvironment(['node', 'x'], {}), 'production');
  assert.equal(resolveEnvironment(['node', 'x'], { PORTAL_ENV: 'homolog' }), 'homolog');
  assert.equal(resolveEnvironment(['node', 'x', 'homolog'], { PORTAL_ENV: 'production' }), 'homolog');
  assert.throws(() => resolveEnvironment(['node', 'x', 'staging'], {}), /Ambiente inválido/);
});

test('fetch homolog sem a env var configurada falha citando a variável exata', () => {
  let failed = false;
  let output = '';
  try {
    execFileSync('node', [path.join(process.cwd(), 'scripts/fetch.js'), 'homolog'], { stdio: 'pipe', env: { PATH: process.env.PATH } });
  } catch (error) {
    failed = true;
    output = `${error.stdout}${error.stderr}`;
  }
  assert.equal(failed, true);
  assert.ok(output.includes('AUTH_SERVER_URL_HML'));
});

test('filterInternalRoutes remove x-internal: true no nível da rota e da operação', () => {
  const { spec, removed } = filterInternalRoutes({
    paths: {
      '/rota-interna': { 'x-internal': true, get: {} },
      '/mista': { get: { 'x-internal': true }, post: { summary: 'fica' } },
      '/so-interna': { get: { 'x-internal': true } },
      '/normal': { get: {} },
    },
  });
  assert.equal('/rota-interna' in spec.paths, false);
  assert.equal('get' in spec.paths['/mista'], false);
  assert.ok(spec.paths['/mista'].post);
  assert.equal('/so-interna' in spec.paths, false, 'rota que ficou sem operações some');
  assert.ok(spec.paths['/normal'].get);
  assert.equal(removed, 3); // rota interna + 2 operações
});
