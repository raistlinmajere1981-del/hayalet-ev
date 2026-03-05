/**
 * Centralized Path Management System
 *
 * Single source of truth for ALL paths in the application.
 *
 * RULES:
 * 1. ALL path construction MUST go through this module
 * 2. NO direct use of process.cwd() outside this file
 * 3. NO hardcoded relative paths (../) outside this file
 * 4. Dev/prod detection happens once, here
 *
 * @module electron/paths
 */

import { app } from "electron";
import { join, dirname } from "path";
import { pathToFileURL } from "url";
import type { PathConfig, PathResolver } from "./types/paths.ts";

// ========================================
// CORE PATH DETECTION (Run Once)
// ========================================

/**
 * Detect if running in packaged (production) mode.
 * Single source of truth for dev/prod detection.
 */
function detectPackagedMode(): boolean {
  return app.isPackaged;
}

/**
 * Resolve project root directory.
 *
 * DEV MODE: /path/to/hayalet-ev (project directory)
 * PACKAGED (PORTABLE): /path/to/hayalet-ev (executable directory)
 *
 * PORTABLE APP STRATEGY:
 * - Data files written next to executable (writable)
 * - Allows USB/portable installation
 * - No user directory dependency
 */
function resolveProjectRoot(): string {
  if (detectPackagedMode()) {
    // Production: use executable directory (portable mode)
    // app.getPath("exe") returns /path/to/hayalet-ev/hayalet-ev
    // dirname gives us /path/to/hayalet-ev (writable directory)
    return dirname(app.getPath("exe"));
  } else {
    // Development: use CWD (assumes npm run dev from project root)
    // eslint-disable-next-line no-restricted-syntax
    return process.cwd();
  }
}

// ========================================
// PATH CONFIGURATION (Initialized Once)
// ========================================

let config: (PathConfig & { electronDir: string }) | null = null;

/**
 * Initialize path configuration.
 * Must be called after app.whenReady() in main.ts.
 */
export function initPaths(electronDirname: string): void {
  if (config !== null) {
    console.warn("[PATHS] Already initialized");
    return;
  }

  const projectRoot = resolveProjectRoot();
  const isPackaged = detectPackagedMode();

  config = {
    projectRoot,
    dataDir: join(projectRoot, "data"),
    configDir: join(projectRoot, "config"),
    logsDir: join(projectRoot, "logs"),
    commandsDir: join(projectRoot, "commands"),
    // Assets only used in dev, in packaged mode they're in app.asar
    assetsDir: isPackaged
      ? join(process.resourcesPath, "app.asar", "src/assets")
      : join(projectRoot, "src", "assets"),
    isPackaged,
    electronDir: electronDirname,
  };
}

/**
 * Get initialized config or throw error.
 */
function getConfig(): PathConfig & { electronDir: string } {
  if (config === null) {
    throw new Error(
      "[PATHS] Not initialized. Call initPaths(electronDirname) in main.ts after app.whenReady()"
    );
  }
  return config;
}

// ========================================
// PATH RESOLVER API
// ========================================

const paths: PathResolver = {
  // --- Base Directories ---

  getProjectRoot(): string {
    return getConfig().projectRoot;
  },

  getDataDir(): string {
    return getConfig().dataDir;
  },

  getConfigDir(): string {
    return getConfig().configDir;
  },

  getLogsDir(): string {
    return getConfig().logsDir;
  },

  getCommandsDir(): string {
    return getConfig().commandsDir;
  },

  getAssetsDir(): string {
    return getConfig().assetsDir;
  },

  // --- Account-Specific Paths ---

  sanitizeAccountId(accountId: string): string {
    // Parse accountId format: email_provider
    const parts = accountId.split("_");
    const provider = parts[parts.length - 1] ?? "unknown";
    const emailCandidate = parts.slice(0, -1).join("_");
    const email = emailCandidate === "" ? "unknown" : emailCandidate;

    // Sanitize email: replace @ and . with _
    const safeEmail = email.replace(/[@.]/g, "_");

    return `${safeEmail}_${provider}`;
  },

  getAccountDir(accountId: string): string {
    const safeName = this.sanitizeAccountId(accountId);
    return join(getConfig().dataDir, safeName);
  },

  getAccountDbPath(accountId: string): string {
    return join(this.getAccountDir(accountId), "archive.db");
  },

  getWhispersPath(): string {
    return join(getConfig().dataDir, "whispers.json");
  },

  // --- Electron-Specific Paths ---

  getPreloadPath(filename: string): string {
    const cfg = getConfig();
    return join(cfg.electronDir, filename);
  },

  getPreloadFileUrl(filename: string): string {
    const filePath = this.getPreloadPath(filename);
    return pathToFileURL(filePath).href;
  },

  getIconPath(): string {
    const cfg = getConfig();
    if (cfg.isPackaged) {
      // Portable: icon next to executable (resources/app.asar/src/assets/icon.png)
      return join(process.resourcesPath, "app.asar", "src/assets/icon.png");
    } else {
      // Dev: icon in src/assets
      return join(cfg.assetsDir, "icon.png");
    }
  },

  getHtmlEntryPath(): string {
    const cfg = getConfig();
    if (cfg.isPackaged) {
      // Portable: HTML in resources (bundled with app)
      return join(process.resourcesPath, "app.asar", "dist/index.html");
    } else {
      // Dev: HTML in dist (built by Vite)
      return join(cfg.projectRoot, "dist", "renderer", "index.html");
    }
  },

  // --- Provider Paths ---

  getProviderConfigPath(providerId: string): string {
    const cfg = getConfig();
    if (cfg.isPackaged) {
      // Portable: provider configs in app.asar (read-only, bundled)
      return join(
        process.resourcesPath,
        "app.asar",
        "src/js/modules/webview/providers",
        providerId,
        "config.js"
      );
    } else {
      // Dev: provider configs in project src (TypeScript source files)
      return join(cfg.projectRoot, "src/js/modules/webview/providers", providerId, "config.ts");
    }
  },

  // --- External Tool Paths ---
  // --- Protocol Paths ---

  getProtocolsPath(): string {
    return join(getConfig().dataDir, "protocols.json");
  },

  // --- Utility Methods ---

  isPackaged(): boolean {
    return getConfig().isPackaged;
  },
};

export { paths as Paths };
