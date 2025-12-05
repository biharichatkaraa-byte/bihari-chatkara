
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // This ensures assets are loaded relatively (e.g. "./assets/...") 
  // instead of absolutely (e.g. "/assets/..."), fixing the white screen on sub-paths.
  base: './', 
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/_status': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
