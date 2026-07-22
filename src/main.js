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
 * Inicialização da aplicação com carregamento da configuração do portal (portal.config.json).
 */
async function bootstrap() {
  const response = await fetch(`${import.meta.env.BASE_URL}portal.config.json`);
  if (!response.ok) {
    document.getElementById('app').textContent =
      'portal.config.json não encontrado — execute `npm run build:content` antes de iniciar o portal.';
    return;
  }
  const portalConfig = await response.json();

  ensureAllMultiSchemeSelections(window.localStorage, getMultiSchemeDocuments(portalConfig.apis));

  const app = createApp(App, { portalConfig });
  app.use(createHead());
  app.mount('#app');
}

bootstrap();