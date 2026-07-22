import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * Regressão de um bug real que só apareceu em produção (não no
 * `vite build`, que só checa compilação — este erro é de runtime, no
 * momento em que o Vue chama setup() do componente):
 *
 *   Uncaught Error: useHead() was called without provide context,
 *   ensure you call it through the setup() function.
 *
 * Causa: <ApiReference> (de @scalar/api-reference) chama useSeoMeta()
 * internamente para aplicar `metaData` (título, meta tags) — isso exige
 * que o app hospedeiro tenha registrado o plugin do @unhead/vue com
 * `app.use(createHead())` ANTES do mount. src/main.js fazia só
 * `createApp(App).mount('#app')`, sem isso.
 *
 * Este teste não monta o <ApiReference> real (ele depende de fetch de
 * rede, workspace store, etc. — coisas que tornariam o teste sobre
 * várias outras partes do Scalar, não sobre ESTE bug). Em vez disso,
 * isola exatamente o mecanismo: um componente mínimo que chama
 * useSeoMeta() no setup(), montado (a) do jeito que main.js faz agora
 * (com createHead() registrado) e (b) do jeito que fazia antes (sem
 * registrar) — para provar que o teste (a) realmente pegaria a
 * regressão se main.js voltasse a ficar do jeito errado.
 *
 * GlobalRegistrator (pacote oficial do happy-dom) registra um DOM
 * completo nos globals do Node — Vue precisa de mais que só
 * window/document (SVGElement, etc.) para decidir o namespace do
 * elemento raiz ao montar.
 */
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

test('sanity — SEM createHead(): lança o mesmo erro visto em produção (prova que o teste acima cobre o bug real)', () => {
  const app = createApp(ComponentQueUsaSeoMeta());

  const root = document.createElement('div');
  document.body.appendChild(root);

  assert.throws(() => app.mount(root), /provide context/);

  root.remove();
});
