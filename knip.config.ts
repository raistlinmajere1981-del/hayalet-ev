import type { KnipConfig } from "knip";

/**
 * Knip Configuration - Unused Code Detection
 * 
 * Optimized: 2026-02-05
 * - Fixed path patterns (mcp-server → src/mcp-server)
 * - Added all MCP dependencies to ignoreDependencies
 * - Cleaned up duplicate type paths (removed src/js/types)
 * - Comprehensive ignore patterns for dynamic modules
 * 
 * Known False Positives (can be ignored):
 * - Configuration hints about MCP dependencies: They ARE used via dynamic imports
 * - Duplicate exports: Intentional for backward compatibility
 */
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
    "src/mcp-server/index.ts",
  ],

  // Project files - analiz edilecek dosyalar
  project: [
    "electron/**/*.{ts,cjs}",
    "src/js/**/*.ts",
    "src/mcp-server/**/*.ts",
  ],

  // Ignore patterns - hariç tutulacaklar
  ignore: [
    // Type definitions
    "src/js/global.d.ts",
    "src/js/vite-env.d.ts",
    
    // Dev/test scripts
    ".rovo/**/*",
    
    // Type barrel exports (public API için gerekli)
    "src/types/**/*",
    "electron/types/**/*",
    
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
    
    // IPC üzerinden dinamik çağrılan (main.ts'de handler via console-logger)
    "electron/server-commands.ts",
    
    // Database store'lar (gelecek kullanım için hazır)
    "src/js/modules/database/conversation-store.ts",
    "src/js/modules/database/message-store.ts",
    
    // Shared helpers (referans olarak tutuluyor)
    "src/js/modules/webview/providers/shared/scraper-helpers.ts",
    
    // Console logger submodules - main.ts'de indirect import edilir
    "electron/logger/**/*",
    
    // MCP server tool modules - dinamik olarak handler registry'den kullanılır
    "src/mcp-server/tools/fs/**/*",
    "src/mcp-server/tools/log/**/*",
    "src/mcp-server/tools/dev/batch-type-fix.ts",
    "src/mcp-server/tools/dev/error-clustering.ts",
    "src/mcp-server/tools/dev/typescript-context-fixer.ts",
    "src/mcp-server/tools/debug-tools.ts",  // Dinamik handler'lar
    "src/mcp-server/tools/filesystem-tools.ts",  // Dinamik handler'lar
    "src/mcp-server/core/index.ts",  // Re-export barrel
    "src/mcp-server/core/handler-registry.ts",  // Public API
    "src/mcp-server/core/handlers.ts",  // Handler utilities
    "src/mcp-server/utils/edit-safety-helpers.ts",  // Utility helpers
    "src/mcp-server/utils/git-utils.ts",  // Utility helpers
    "src/mcp-server/utils/ast-transformer.ts",  // Public utilities
    "src/mcp-server/utils/diff-utils.ts",  // Public utilities
    "src/mcp-server/utils/progress.ts",  // Public utilities
    "src/mcp-server/utils/timeouts.ts",  // Public utilities
    "src/mcp-server/utils/web-scraper.ts",  // Public utilities
    "src/mcp-server/utils/provider-config.ts",  // Type definitions
    
    // Logger ve provider factory - internal utilities
    "src/js/modules/logger/Logger.ts",  // Public API default export
    "src/js/modules/webview/provider-factory.ts",  // Private methods (_prefixed)
  ],

  // Ignore dependencies - build/CI araçları ve özel kullanımlar
  ignoreDependencies: [
    "electron-builder",   // build script
    "depcheck",           // manual check tool
    "gsap",               // animasyon kütüphanesi (gelecek kullanım)
    "@eslint/js",         // eslint peer dependency
    "eslint-formatter-compact",  // eslint config'de kullanılıyor
    "cheerio",            // web-scraper.ts
    "@babel/parser",      // scope-validator.ts, structure-visualizer.ts
  ],

  // npx ile çalıştırılan binary'ler
  ignoreBinaries: [
    "npm-check-updates",  // npx ile çalıştırılıyor
    "tail",               // manual debugging tool
  ],

  // Ignore exports - barrel exports ve public API'ler
  ignoreExportsUsedInFile: true,

  // Plugin configurations
  eslint: {
    config: ["eslint.config.cjs"],
  },

  typescript: {
    config: ["tsconfig.json", "tsconfig.electron.json", "tsconfig.mcp.json"],
  },
};

export default config;
