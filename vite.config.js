import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Configuração do Vite.
 *
 * Define o caminho base (`base`) a partir da variável de ambiente VITE_BASE_PATH
 * para suporte a implantações em subdiretórios (ex.: GitHub Pages).
 */
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});