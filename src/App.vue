<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { ApiReference } from '@scalar/api-reference';
import mediumZoom from 'medium-zoom';
import SidebarBrand from './components/SidebarBrand.vue';
import { buildScalarConfiguration } from './config/scalar.config.js';
import { createSciPortalPlugin } from './plugins/sci-token-plugin.js';
import { installTokenStorageGuard, getTokenStorageTargets } from './plugins/token-storage.js';

const props = defineProps({
  portalConfig: { type: Object, required: true },
});

const { plugin: sciPortalPlugin, state } = createSciPortalPlugin({ portalConfig: props.portalConfig });
installTokenStorageGuard(window.localStorage, state, getTokenStorageTargets(props.portalConfig.apis));

const configuration = computed(() =>
  buildScalarConfiguration(props.portalConfig, import.meta.env.BASE_URL, { plugins: [sciPortalPlugin()] })
);

let zoomInstance = null;
let observer = null;

const applyZoom = () => {
  // Seleciona apenas imagens do conteúdo Markdown, ignorando badges, logo do sidebar e imagens desabilitadas
  const images = Array.from(
    document.querySelectorAll(
      '.scalar-api-reference img:not([src*="shields.io"]):not(.sidebar-brand img):not([data-medium-zoom-disabled])'
    )
  ).filter((img) => !img.classList.contains('medium-zoom-image'));

  if (images.length > 0) {
    if (!zoomInstance) {
      zoomInstance = mediumZoom({
        margin: 24,
        background: 'rgba(0, 0, 0, 0.85)',
      });
    }
    zoomInstance.attach(images);
  }
};

onMounted(() => {
  applyZoom();

  // MutationObserver para reanexar o zoom quando novas páginas/rotas carregarem, ignorando alterações do próprio zoom
  observer = new MutationObserver((mutations) => {
    const isZoomMutation = mutations.some((m) =>
      Array.from(m.addedNodes).some(
        (node) =>
          node.classList &&
          (node.classList.contains('medium-zoom-overlay') || node.classList.contains('medium-zoom-image'))
      )
    );

    if (!isZoomMutation) {
      applyZoom();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});

onUnmounted(() => {
  if (observer) observer.disconnect();
  if (zoomInstance) zoomInstance.detach();
});
</script>

<template>
  <ApiReference :configuration="configuration">
    <template #sidebar-start>
      <SidebarBrand />
    </template>
  </ApiReference>
</template>