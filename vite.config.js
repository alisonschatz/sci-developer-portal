import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Se o portal for publicado como GitHub Pages de PROJETO (não de usuário/organização),
// a URL final fica em https://<org>.github.io/<repo>/ — ou seja, tudo precisa ser
// resolvido a partir de "/<repo>/", não da raiz "/". Configure isso via a env var
// VITE_BASE_PATH no workflow de deploy (ver .github/workflows/deploy-docs.yml).
// Localmente, ou em um domínio próprio, deixe em branco para usar "/".
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
