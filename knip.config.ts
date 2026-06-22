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
    "src/js/ui/index.ts",

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

    // Script entries invoked by package scripts, Electron hooks, or child processes
    "scripts/backup-cli.mjs",
    "scripts/dev-restart-helper.mjs",
    "scripts/electron-builder-after-pack.mjs",
    "scripts/sync-mcp-dist.mjs",
    "scripts/rooms/build-room-bundle.mjs",
    "scripts/rooms/build-workspace-rooms.ts",
    "scripts/rooms/clean-generated-room-artifacts.ts",
    "scripts/rooms/report-room-paths.ts",
    "scripts/tests/register-asset-loader.mjs",
    "scripts/tests/run-all-tests.mjs",

    // Game room IIFE modules are loaded through HTML script tags
    "rooms/game-room/ui/*.ts",
    "rooms/game-room/shared/ui/*.ts",
    "rooms/game-room/shared/vendor/konva.min.js",
    "rooms/game-room/main-functions/*/ui/*.ts",

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

  ignoreFiles: [
    "electron/native/node-abi.d.ts",
    "ghost-agent/src/renderer/global.d.ts",
    "rooms/global.d.ts",
    "src/js/global.d.ts",
    "src/js/vite-env.d.ts",
  ],

  ignoreDependencies: [
    "depcheck", // manual dependency audit fallback
    "eslint-formatter-compact", // kept for ad-hoc ESLint formatter runs
    "@electron/rebuild", // invoked via node_modules path from better-sqlite3 runtime helper
  ],

  // Barrel exports and room/MCP public APIs often re-export symbols for dynamic registries.
  ignoreExportsUsedInFile: true,

  // Public API/type surface findings stay visible without breaking strict dependency/file gates.
  rules: {
    exports: "warn",
    types: "warn",
  },

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
