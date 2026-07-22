<script setup>
import { ref } from 'vue';
import { useSidebarStickyOffset } from '../composables/useSidebarStickyOffset.js';

const rootEl = ref(null);
const logoFailed = ref(false);

// Mede tudo que fica fixo acima da lista rolável da sidebar (este bloco
// + seletor de documentos + busca) e publica em
// --scalar-sidebar-sticky-offset — ver
// src/composables/useSidebarStickyOffset.js para o porquê e os testes.
useSidebarStickyOffset(rootEl);
</script>

<template>
  <div ref="rootEl" class="sidebar-brand">
    <a class="sidebar-brand__logo" :class="{ 'is-fallback': logoFailed }" href="/" aria-label="SCI Sistemas Contábeis">
      <img src="/assets/sci-logo.png" alt="" @error="logoFailed = true" />
      <strong class="sidebar-brand__logo-fallback">SCI</strong>
    </a>
    <div class="sidebar-brand__title">
      <strong>Portal do Desenvolvedor</strong>
      <span>APIs da SCI</span>
    </div>
  </div>
</template>

<style scoped>
/*
 * Usa as próprias CSS vars de sidebar do Scalar (--scalar-sidebar-*) em
 * vez das vars de marca (--sci-*) diretamente, com fallback para elas —
 * assim, se o tema do Scalar mudar de paleta (claro/escuro, ou o preset
 * `theme` na configuration), este bloco acompanha automaticamente e
 * continua parecendo parte nativa da sidebar, não uma caixa colada.
 */
/*
 * O <aside> real da sidebar do Scalar é um único flex container
 * (flex-direction: column) — confirmado em
 * node_modules/@scalar/components/dist/components/ScalarSidebar/ScalarSidebar.vue.script.js.
 * TODOS os itens (seletor de documentos, busca, este bloco via
 * sidebar-start, a árvore de navegação) são filhos diretos dele, sem
 * nenhuma div extra entre eles — e o Scalar sempre renderiza o
 * conteúdo de `sidebar-start` DEPOIS do seletor e da busca (ordem fixa
 * no template deles, não é configurável por prop). `order: -1` aqui
 * reordena só visualmente (a árvore de acessibilidade/DOM não muda) pra
 * este bloco vir antes dos dois, sem precisar de nenhum CSS global nem
 * tocar em nada do Scalar.
 */
.sidebar-brand {
  order: -1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--scalar-sidebar-border-color, var(--sci-border));
  background: var(--scalar-sidebar-background-1, var(--sci-bg));
}

.sidebar-brand__logo {
  display: flex;
  align-items: center;
  flex: none;
  text-decoration: none;
}

.sidebar-brand__logo img {
  height: 28px;
  width: 28px;
  display: block;
  border-radius: 50%;
}

.sidebar-brand__logo-fallback {
  display: none;
  font-size: 14px;
  font-weight: 700;
  color: var(--scalar-sidebar-color-1, var(--sci-navy));
  letter-spacing: 0.02em;
}

.sidebar-brand__logo.is-fallback img {
  display: none;
}

.sidebar-brand__logo.is-fallback .sidebar-brand__logo-fallback {
  display: block;
}

.sidebar-brand__title {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.sidebar-brand__title strong {
  font-size: 13px;
  font-weight: 650;
  color: var(--scalar-sidebar-color-1, var(--sci-navy));
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-brand__title span {
  font-size: 11px;
  color: var(--scalar-sidebar-color-2, var(--sci-text-soft));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
