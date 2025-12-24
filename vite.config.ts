import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  // Fix: Cast process to any to resolve TypeScript error 'Property cwd does not exist on type Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: './', 
    define: {
      // This makes process.env.API_KEY available to the browser code
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
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
  };
});