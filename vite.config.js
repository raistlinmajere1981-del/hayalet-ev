import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        'asistan-native': resolve(__dirname, 'src/pages/asistan-native.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      // Allow serving files from src directory
      allow: ['..'],
    },
  },
  appType: 'mpa', // Multi-page app mode - disable SPA fallback
  optimizeDeps: {
    exclude: ['@xterm/xterm', '@xterm/addon-fit']
  }
});
