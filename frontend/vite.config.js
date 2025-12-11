import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    global: 'globalThis',
    'process.env': {}
  },
  optimizeDeps: {
    include: ['amazon-chime-sdk-js']
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        globals: {
          'global': 'globalThis'
        }
      }
    }
  }
});