import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const { findPreScrollSiblings, computeStickyOffsetHeight } = await import(
  '../src/composables/useSidebarStickyOffset.js'
);

/** Cria um elemento com uma altura "fake" (happy-dom não faz layout de
 *  verdade — getBoundingClientRect sempre voltaria 0 — então simulamos
 *  o valor que um navegador real reportaria). */
function elWithHeight(height, className) {
  const el = document.createElement('div');
  if (className) el.className = className;
  el.getBoundingClientRect = () => ({ height, width: 0, top: 0, left: 0, right: 0, bottom: 0 });
  return el;
}

function buildSidebarStructure({ withScrollArea = true } = {}) {
  const aside = document.createElement('aside');

  const brand = elWithHeight(48);
  const documentSelector = elWithHeight(32);
  const search = elWithHeight(36);

  aside.appendChild(brand);
  aside.appendChild(documentSelector);
  aside.appendChild(search);

  if (withScrollArea) {
    const scrollArea = elWithHeight(1000, 'custom-scroll');
    aside.appendChild(scrollArea);
    const afterScroll = elWithHeight(20); // ex.: footer — não deveria contar
    aside.appendChild(afterScroll);
  }

  document.body.appendChild(aside);
  return { aside, brand, documentSelector, search };
}

test('findPreScrollSiblings retorna tudo antes do .custom-scroll, na ordem do DOM', () => {
  const { brand, documentSelector, search } = buildSidebarStructure();

  const result = findPreScrollSiblings(brand);

  assert.deepEqual(result, [brand, documentSelector, search]);
});

test('computeStickyOffsetHeight soma a altura de brand + seletor + busca, ignorando o que vem depois do scroll', () => {
  const { brand } = buildSidebarStructure();

  const height = computeStickyOffsetHeight(brand);

  // 48 (brand) + 32 (seletor) + 36 (busca) = 116 — NÃO inclui a área de
  // scroll (1000) nem o que vem depois dela (20).
  assert.equal(height, 116);
});

test('fallback: sem nenhum .custom-scroll entre os irmãos, mede só o próprio bloco', () => {
  const { brand } = buildSidebarStructure({ withScrollArea: false });

  assert.deepEqual(findPreScrollSiblings(brand), [brand]);
  assert.equal(computeStickyOffsetHeight(brand), 48);
});

test('fallback: elemento sem pai (ainda não inserido no DOM) não lança erro', () => {
  const orphan = elWithHeight(10);
  assert.deepEqual(findPreScrollSiblings(orphan), [orphan]);
  assert.equal(computeStickyOffsetHeight(orphan), 10);
});

test('findPreScrollSiblings(null) não lança erro', () => {
  assert.deepEqual(findPreScrollSiblings(null), []);
});
