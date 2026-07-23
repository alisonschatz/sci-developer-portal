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
  const images = Array.from(
    document.querySelectorAll('.scalar-api-reference img:not([src*="shields.io"]):not(.medium-zoom-image)')
  );

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
  observer = new MutationObserver(() => {
    applyZoom();
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