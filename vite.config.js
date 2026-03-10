import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: "src",
  base: "./",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "src/types"),
      "@electron": resolve(__dirname, "electron"),
      "@timeouts": resolve(__dirname, "shared/timeouts.ts"),
      "@limits": resolve(__dirname, "shared/limits.ts"),
      "@slots": resolve(__dirname, "shared/slots.ts"),
      "@ui-constants": resolve(__dirname, "shared/ui-constants.ts"),
    },
  },
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        entrance: resolve(__dirname, "src/pages/entrance.html"),
        asistan: resolve(__dirname, "src/pages/assistant.html"),
        analyze: resolve(__dirname, "src/pages/analyze.html"),
        archives: resolve(__dirname, "src/pages/archives.html"),
        server: resolve(__dirname, "src/pages/server.html"),
        whisper: resolve(__dirname, "src/pages/whisper.html"),
        opencodeUi: resolve(__dirname, "src/pages/opencode-ui.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Allow serving files from src directory
      allow: [".."],
    },
  },
  appType: "mpa", // Multi-page app mode - disable SPA fallback
  optimizeDeps: {
    exclude: ["@xterm/xterm", "@xterm/addon-fit"],
  },
});
