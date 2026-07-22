import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { insertApiBlock } from '../scripts/new-api.js';

const MARKER = '  // ── Próxima API entra aqui (npm run api:new) ─────────────────────────';

test('insertApiBlock insere antes do marcador, preservando o marcador pra próxima', () => {
  const source = `export const apis = [\n  { id: 'auth' },\n\n${MARKER}\n];`;
  const out = insertApiBlock(source, "  { id: 'nova' },");
  assert.ok(out.indexOf("{ id: 'nova' }") < out.indexOf(MARKER));
  assert.ok(out.includes(MARKER));
});

test('insertApiBlock lança com instrução manual se o marcador sumiu', () => {
  assert.throws(() => insertApiBlock('sem marcador', 'x'), /Marcador de inserção não encontrado em apis.config.js/);
});

test('o apis.config.js real ainda contém o marcador de inserção', () => {
  assert.ok(fs.readFileSync('apis.config.js', 'utf8').includes(MARKER));
});