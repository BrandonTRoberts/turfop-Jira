import path from "path"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
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