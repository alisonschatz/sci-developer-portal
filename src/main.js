import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import '@scalar/api-reference/style.css';
import './style.css';
import App from './App.vue';
import {
  ensureAllMultiSchemeSelections,
  getMultiSchemeDocuments,
} from './plugins/token-storage.js';

/**
 * Bootstrap assíncrono: o frontend consome o portal.config.json gerado
 * pelo build (ambiente + APIs resolvidas — schemes já detectados, URLs
 * do ambiente certo). Autoria (apis.config.js) e runtime são camadas
 * separadas de propósito — ver docs/arquitetura.md.
 */
async function bootstrap() {
  const response = await fetch(`${import.meta.env.BASE_URL}portal.config.json`);
  if (!response.ok) {
    document.getElementById('app').textContent =
      'portal.config.json não encontrado — rode `npm run build:content` antes de iniciar o portal.';
    return;
  }
  const portalConfig = await response.json();

  // Autocura: topo do documento Auth sempre com os dois schemes.
  ensureAllMultiSchemeSelections(window.localStorage, getMultiSchemeDocuments(portalConfig.apis));

  const app = createApp(App, { portalConfig });
  app.use(createHead()); // <ApiReference> usa useSeoMeta() — exige o plugin ANTES do mount
  app.mount('#app');
}

bootstrap();
