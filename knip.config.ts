import type { KnipConfig } from "knip";

/**
 * Knip Configuration - unused code/dependency detection.
 *
 * Keep this map close to the repo's real execution surfaces:
 * Electron bundles, Vite page entries, MCP package entries, Ghost Agent,
 * dynamic room packages, scripts, tests, and shared TypeScript modules.
 */
const config: KnipConfig = {
  entry: [
    // Ghost Agent tooling entry
    "ghost-agent/vite.config.js",

    // Electron runtime and packaged wrapper entries
    "electron/main.ts",
    "electron/preload.cjs",
    "electron/webview-preload.cjs",
    "electron/room-webview-preload.cjs",
    "electron/packaged-wrapper-main.ts",
    "electron/packaged-wrapper-cli.ts",
    "electron/native/better-sqlite3-runtime.js",

    // Renderer entries loaded from HTML/preload and page shell routes
    "src/js/app.ts",
    "src/js/pages/*.ts",
    "src/js/pages/*/app.ts",
    "src/js/modules/commands/*.ts",

    // MCP runtime entries
    "mcp-server/index.ts",
    "mcp-server/standalone.ts",

    // Ghost Agent entries
    "ghost-agent/electron/main.ts",
    "ghost-agent/electron/preload.cjs",
    "ghost-agent/src/renderer/index.ts",

    // Room package convention entries loaded through manifests/registries
    "rooms/*/host/index.ts",
    "rooms/*/host/runtime.ts",
    "rooms/*/ui/index.ts",
    "rooms/*/ui/bootstrap.ts",
    "rooms/*/scripts/*.ts",

    // Test runner discovers these dynamically
    "scripts/tests/**/*.test.ts",
    "scripts/tests/**/*.helpers.ts",
  ],

  project: [
    "electron/**/*.{ts,cjs,js}",
    "src/js/**/*.{js,ts,d.ts}",
    "src/types/**/*.ts",
    "shared/**/*.ts",
    "mcp-server/**/*.{js,ts}",
    "ghost-agent/**/*.{js,cjs,ts,d.ts}",
    "rooms/**/*.{js,ts,d.ts}",
    "scripts/**/*.{js,mjs,ts}",
    "*.config.{js,cjs,ts}",
  ],

  ignoreDependencies: [
    "depcheck", // manual dependency audit fallback
    "eslint-formatter-compact", // kept for ad-hoc ESLint formatter runs
    "@electron/rebuild", // invoked via node_modules path from better-sqlite3 runtime helper
  ],

  // Barrel exports and room/MCP public APIs often re-export symbols for dynamic registries.
  ignoreExportsUsedInFile: true,

  eslint: {
    config: ["eslint.config.cjs"],
  },

  typescript: {
    config: [
      "src/tsconfig.json",
      "electron/tsconfig.electron.json",
      "mcp-server/tsconfig.mcp.json",
      "ghost-agent/tsconfig.json",
      "ghost-agent/tsconfig.electron.json",
      "rooms/tsconfig.rooms.json",
      "scripts/tsconfig.json",
    ],
  },
};

export default config;
