import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvTemplate, parseEnvKeys, mergeEnvContent } from '../scripts/env.js';

test('buildEnvTemplate deriva as variáveis dos ids do manifesto (prod + hml)', () => {
  const t = buildEnvTemplate([{ id: 'nova-api', title: 'Nova API' }]);
  assert.ok(t.includes('NOVA_API_SERVER_URL='));
  assert.ok(t.includes('NOVA_API_SERVER_URL_HML='));
});

test('mergeEnvContent acrescenta só as chaves faltantes, sem tocar em valores existentes', () => {
  const template = 'A=\nB=\nC=\n';
  const existing = '# meu env\nA=https://preenchido\nB=\n';
  const { content, added } = mergeEnvContent(template, existing);
  assert.deepEqual(added, ['C']);
  assert.ok(content.includes('A=https://preenchido'));
  assert.ok(content.includes('C='));
  // idempotente
  assert.deepEqual(mergeEnvContent(template, content).added, []);
});

test('parseEnvKeys ignora comentários e linhas inválidas', () => {
  const keys = parseEnvKeys('# comentário\nX=1\nlinha solta\nY=');
  assert.equal(keys.get('X'), '1');
  assert.equal(keys.get('Y'), '');
  assert.equal(keys.size, 2);
});
