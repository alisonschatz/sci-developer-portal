import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const { createApp, defineComponent, h } = await import('vue');
const { createHead } = await import('@unhead/vue/client');
const { useSeoMeta } = await import('@unhead/vue');

function ComponentQueUsaSeoMeta() {
  return defineComponent({
    setup() {
      useSeoMeta({ title: 'Portal do Desenvolvedor — SCI' });
      return () => h('div', 'ok');
    },
  });
}

test('com createHead() + app.use() ANTES do mount (main.js atual): não lança', () => {
  const app = createApp(ComponentQueUsaSeoMeta());
  const head = createHead();
  app.use(head);

  const root = document.createElement('div');
  document.body.appendChild(root);

  assert.doesNotThrow(() => app.mount(root));

  app.unmount();
  root.remove();
});

test('sanity — SEM createHead(): lança o mesmo erro visto em produção', () => {
  const app = createApp(ComponentQueUsaSeoMeta());
  const root = document.createElement('div');
  document.body.appendChild(root);

  // Silencia temporariamente os avisos de console do Vue para este teste
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};

  try {
    assert.throws(() => app.mount(root), /provide context/);
  } finally {
    // Restaura o console original imediatamente após o teste
    console.warn = originalWarn;
    console.error = originalError;
    root.remove();
  }
});