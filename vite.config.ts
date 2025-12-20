import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Базовый путь важен для GitHub Pages, если сайт не в корне домена
  base: './',
  define: {
    // Полифилл для process.env, чтобы код не падал в браузере
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
  }
});