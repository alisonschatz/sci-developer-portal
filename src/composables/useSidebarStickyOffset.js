import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Retorna os elementos irmãos que vêm ANTES do primeiro `.custom-scroll`
 * dentro do pai de `rootEl` — ou seja, tudo que fica fixo (não rolável)
 * acima da lista de navegação da sidebar. `.custom-scroll` é a classe
 * que o Scalar usa no contêiner rolável (confirmado em
 * node_modules/@scalar/components, reutilizada em vários componentes
 * deles — por isso a busca é escopada a `:scope > .custom-scroll`,
 * filhos diretos do mesmo pai, não a página inteira).
 *
 * Pura e sem Vue — testável diretamente em test/sidebar-sticky-offset.test.js.
 */
export function findPreScrollSiblings(rootEl) {
  const parent = rootEl?.parentElement;
  if (!parent) return rootEl ? [rootEl] : [];

  const scrollArea = parent.querySelector(':scope > .custom-scroll');
  if (!scrollArea) return [rootEl];

  const siblings = [];
  for (const child of parent.children) {
    if (child === scrollArea) break;
    siblings.push(child);
  }
  return siblings.length > 0 ? siblings : [rootEl];
}

/** Soma a altura de todos os elementos retornados por findPreScrollSiblings. */
export function computeStickyOffsetHeight(rootEl) {
  const targets = findPreScrollSiblings(rootEl);
  const total = targets.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
  return Math.ceil(total);
}

/**
 * Composable Vue: mede e publica `--scalar-sidebar-sticky-offset`
 * (usada pelos cabeçalhos de grupo sticky dentro da árvore de
 * navegação do Scalar — ver comentário em findPreScrollSiblings) toda
 * vez que algum dos elementos "fixos acima do scroll" mudar de
 * tamanho.
 *
 * @param {import('vue').Ref<HTMLElement|null>} rootElRef
 * @param {string} cssVariable
 */
export function useSidebarStickyOffset(rootElRef, cssVariable = '--scalar-sidebar-sticky-offset') {
  let resizeObserver;

  function publish() {
    if (!rootElRef.value) return;
    const height = computeStickyOffsetHeight(rootElRef.value);
    document.documentElement.style.setProperty(cssVariable, `${height}px`);
  }

  onMounted(() => {
    publish();
    resizeObserver = new ResizeObserver(publish);
    findPreScrollSiblings(rootElRef.value).forEach((el) => resizeObserver.observe(el));
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    // Não deixa a variável "presa" num valor antigo se este componente
    // algum dia for desmontado condicionalmente.
    document.documentElement.style.removeProperty(cssVariable);
  });
}
