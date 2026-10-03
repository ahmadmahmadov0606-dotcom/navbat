import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = process.env.VITE_BACKEND || 'http://localhost:8000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/static/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom'], query: ['@tanstack/react-query'] } },
    },
  },
  server: {
    port: 5174,
    proxy: { '/api': backend, '/admin': backend, '/static/admin': backend },
  },
}));
