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

import { join } from "path";
import { pathToFileURL } from "url";
import type { PathConfig, PathResolver } from "./types/paths.ts";
import { readElectronAppLanguageSync } from "./i18n/language-service.ts";
import { getBuiltInLanguagePack } from "../shared/i18n/bundled-languages.ts";
import { translateCatalog } from "../shared/i18n/catalog.ts";
import { DEFAULT_APP_LANGUAGE } from "../src/types/i18n.ts";
import {
  detectPackagedMode,
  resolveAssetsDir,
  resolveConfigDir,
  resolveDataDir,
  resolveProjectRoot,
} from "./path-roots.ts";

// ========================================
// CORE PATH DETECTION (Run Once)
// ========================================

// ========================================
// PATH CONFIGURATION (Initialized Once)
// ========================================

let config: (PathConfig & { electronDir: string }) | null = null;

function pathsT(key: string): string {
  const locale = readElectronAppLanguageSync();
  const activeCatalog =
    getBuiltInLanguagePack(locale)?.catalog ??
    getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;
  const fallbackCatalog = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;

  return translateCatalog(
    activeCatalog ?? fallbackCatalog ?? {},
    `electron.paths.${key}`,
    undefined,
    fallbackCatalog
  );
}

/**
 * Initialize path configuration.
 * Must be called after app.whenReady() in main.ts.
 */
export function initPaths(electronDirname: string): void {
  if (config !== null) {
    console.warn(pathsT("alreadyInitialized"));
    return;
  }

  const projectRoot = resolveProjectRoot();
  const isPackaged = detectPackagedMode();

  config = {
    projectRoot,
    dataDir: resolveDataDir(),
    configDir: resolveConfigDir(),
    logsDir: join(projectRoot, "logs"),
    commandsDir: join(projectRoot, "commands"),
    assetsDir: resolveAssetsDir(),
    isPackaged,
    electronDir: electronDirname,
  };
}

/**
 * Get initialized config or throw error.
 */
function getConfig(): PathConfig & { electronDir: string } {
  if (config === null) {
    throw new Error(pathsT("notInitialized"));
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

  getRoomsWorkspaceDir(): string {
    return join(getConfig().projectRoot, "rooms");
  },

  getInstalledRoomsDir(): string {
    return join(getConfig().dataDir, "rooms");
  },

  getRoomsRegistryPath(): string {
    return join(getConfig().configDir, "rooms.json");
  },

  getInstalledRoomDir(roomId: string): string {
    return join(this.getInstalledRoomsDir(), roomId);
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
