import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Retorna os elementos irmãos anteriores ao contêiner rolável (.custom-scroll)
 * dentro do mesmo elemento pai de `rootEl`.
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

/** Soma a altura total dos elementos que antecedem o contêiner rolável. */
export function computeStickyOffsetHeight(rootEl) {
  const targets = findPreScrollSiblings(rootEl);
  const total = targets.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
  return Math.ceil(total);
}

/**
 * Composable que monitora a dimensão dos elementos fixos superiores da sidebar
 * e atualiza a variável CSS configurada com a altura acumulada.
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
    document.documentElement.style.removeProperty(cssVariable);
  });
}