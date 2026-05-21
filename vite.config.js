import path from "path"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.jsx',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['backend/**', 'node_modules/**', 'dist/**', 'android/**', 'ios/**'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts';
          if (id.includes('node_modules/@dnd-kit')) return 'drag-drop';
          if (id.includes('node_modules/radix-ui')) return 'radix-ui';
          if (id.includes('node_modules/lucide-react')) return 'icons';
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    }
  }
});
