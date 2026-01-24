import type { KnipConfig } from "knip";

const config: KnipConfig = {
  // Entry points - uygulamanın başlangıç noktaları
  entry: [
    // Electron
    "electron/main.ts",
    "electron/preload.cjs",
    "electron/webview-preload.cjs",
    
    // Renderer
    "src/js/app.ts",
    "src/js/pages/*.ts",
    "src/js/modules/commands/*.ts",  // Dinamik command handler'lar
    
    // MCP Server
    "mcp-server/index.ts",
  ],

  // Project files - analiz edilecek dosyalar
  project: [
    "electron/**/*.{ts,cjs}",
    "src/js/**/*.ts",
    "mcp-server/**/*.ts",
  ],

  // Ignore patterns - hariç tutulacaklar
  ignore: [
    // Type definitions
    "src/js/global.d.ts",
    "src/js/vite-env.d.ts",
    
    // Dev/test scripts
    ".rovodev/**/*",
    
    // OpenCode UI - klasik script tag ile yükleniyor, ES modules değil
    "src/opencode-ui/**/*",
    
    // Type barrel exports (public API)
    "src/js/types/**/*",
    "electron/types/**/*",
    "mcp-server/types/**/*",
    
    // Barrel export dosyaları (re-exports)
    "src/js/modules/database/index.ts",
    "src/js/modules/relay/index.ts",
    "src/js/modules/slot/index.ts",
    "src/js/modules/webview/index.ts",
    "src/js/ui/index.ts",
    
    // Gelecek kullanım için tutulan modüller
    "src/js/ui/animation-controller.ts",
    "src/js/ui/audio-manager.ts",
    "src/js/ui/canvas-manager.ts",
    "src/js/ui/modal-manager.ts",
    "src/js/modules/ipc-client.ts",
    
    // IPC üzerinden dinamik çağrılan (main.ts'de handler)
    "electron/server-commands.ts",
    
    // Database store'lar (gelecek kullanım için hazır)
    "src/js/modules/database/conversation-store.ts",
    "src/js/modules/database/message-store.ts",
    
    // Shared helpers (referans olarak tutuluyor)
    "src/js/modules/webview/providers/shared/scraper-helpers.ts",
  ],

  // Ignore dependencies - build/CI araçları ve özel kullanımlar
  ignoreDependencies: [
    "@electron/rebuild",  // postinstall script
    "electron-builder",   // build script
    "depcheck",           // manual check tool
    "gsap",               // animasyon kütüphanesi (gelecek kullanım)
    "@eslint/js",         // eslint peer dependency
    // mcp-server dependencies (kendi package.json'ında)
    "@modelcontextprotocol/sdk",
    "cheerio",
    "domhandler",         // cheerio'nun dependency'si
  ],

  // npx ile çalıştırılan binary'ler
  ignoreBinaries: [
    "npm-check-updates",  // npx ile çalıştırılıyor
  ],

  // Ignore exports - barrel exports ve public API'ler
  ignoreExportsUsedInFile: true,

  // Plugin configurations
  eslint: {
    config: ["eslint.config.cjs"],
  },

  typescript: {
    config: ["tsconfig.json", "tsconfig.electron.json", "mcp-server/tsconfig.json"],
  },
};

export default config;
