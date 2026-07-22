<script setup>
import { computed } from 'vue';
import { ApiReference } from '@scalar/api-reference';
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
</script>

<template>
  <ApiReference :configuration="configuration">
    <template #sidebar-start>
      <SidebarBrand />
    </template>
  </ApiReference>
</template>