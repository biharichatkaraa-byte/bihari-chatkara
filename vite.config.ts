import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    // Use relative paths for assets so it works on any subfolder (like github.io/repo-name/)
    base: './', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    server: {
      port: 3000,
      proxy: {
        '/api': 'http://localhost:8080',
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
    }
  };
});