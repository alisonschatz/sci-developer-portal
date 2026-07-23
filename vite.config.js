import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Configuração do Vite.
 *
 * Carrega VITE_BASE_PATH do ambiente (definido no CI/CD para GitHub Pages)
 * e aplica como caminho base da aplicação.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue()],
    base: env.VITE_BASE_PATH || '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});