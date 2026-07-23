import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScalarSources, buildScalarConfiguration } from '../src/config/scalar.config.js';

const portalConfig = JSON.parse(fs.readFileSync('test/fixtures/portal.config.fixture.json', 'utf8'));

test('buildScalarSources gera um source por API resolvida, com url derivada do baseUrl', () => {
  const sources = buildScalarSources(portalConfig, '/portal/');
  assert.equal(sources.length, 2);
  const auth = sources.find((s) => s.slug === 'auth');
  assert.equal(auth.url, '/portal/openapi/auth.json');
  assert.equal(auth.default, true);
});

test('caso simples (securityScheme resolvido): preferido + prefill com a variável do config', () => {
  const rh = buildScalarSources(portalConfig).find((s) => s.slug === 'rhnetsocial');
  assert.equal(rh.authentication.preferredSecurityScheme, 'bearerAuth');
  assert.equal(rh.authentication.securitySchemes.bearerAuth.token, '{{sci_auth_token}}');
});

test('caso rico (auth): nenhum preferido; só schemes com prefill entram', () => {
  const auth = buildScalarSources(portalConfig).find((s) => s.slug === 'auth');
  assert.equal(auth.authentication.preferredSecurityScheme, null);
  assert.equal('Gerar JWT' in auth.authentication.securitySchemes, false);
  assert.equal(auth.authentication.securitySchemes['Atualizar JWT'].token, '{{sci_auth_token}}');
});

test('configuration global + plugins injetados + título marca homologação', () => {
  const fake = () => ({});
  const config = buildScalarConfiguration(portalConfig, '/', { plugins: [fake] });
  assert.equal(config.theme, 'none');
  assert.equal(config.persistAuth, true);
  assert.deepEqual(config.plugins, [fake]);
  assert.equal(config.metaData.title.includes('Homologação'), false);

  const hml = buildScalarConfiguration({ ...portalConfig, environment: 'homolog' }, '/');
  assert.ok(hml.metaData.title.includes('Homologação'));
});

test('campos por-documento não vazam pro nível global', () => {
  const config = buildScalarConfiguration(portalConfig);
  for (const key of ['title', 'slug', 'default', 'authentication']) {
    assert.equal(key in config, false, key);
  }
});
