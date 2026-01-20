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
        'opencode-ui': resolve(__dirname, 'src/opencode-ui/index.html'),
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
