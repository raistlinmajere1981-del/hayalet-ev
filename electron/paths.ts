// NOTE: All path construction must go through this module; avoid process.cwd() or ../ paths elsewhere.
// NOTE: Dev/prod detection should only happen here.

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

let config: (PathConfig & { electronDir: string }) | null = null;
const MAIN_APP_LOG_DIR_NAME = "hayalet-ev";
const LEGACY_MAIN_APP_LOG_DIR_NAME = "app";

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

// NOTE: Call after app.whenReady() in main.ts.
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

function getConfig(): PathConfig & { electronDir: string } {
  if (config === null) {
    throw new Error(pathsT("notInitialized"));
  }
  return config;
}

const paths: PathResolver = {
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

  getMainAppLogsDir(): string {
    return join(getConfig().logsDir, MAIN_APP_LOG_DIR_NAME);
  },

  getLegacyMainAppLogsDir(): string {
    return join(getConfig().logsDir, LEGACY_MAIN_APP_LOG_DIR_NAME);
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

  sanitizeAccountId(accountId: string): string {
    const parts = accountId.split("_");
    const provider = parts[parts.length - 1] ?? "unknown";
    const emailCandidate = parts.slice(0, -1).join("_");
    const email = emailCandidate === "" ? "unknown" : emailCandidate;

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
      return join(process.resourcesPath, "app.asar", "src/assets/icon.png");
    } else {
      return join(cfg.assetsDir, "icon.png");
    }
  },

  getHtmlEntryPath(): string {
    const cfg = getConfig();
    if (cfg.isPackaged) {
      return join(process.resourcesPath, "app.asar", "dist/index.html");
    } else {
      return join(cfg.projectRoot, "dist", "renderer", "index.html");
    }
  },

  getProviderConfigPath(providerId: string): string {
    const cfg = getConfig();
    if (cfg.isPackaged) {
      return join(
        process.resourcesPath,
        "app.asar",
        "src/js/modules/webview/providers",
        providerId,
        "config.js"
      );
    } else {
      return join(cfg.projectRoot, "src/js/modules/webview/providers", providerId, "config.ts");
    }
  },

  getProtocolsPath(): string {
    return join(getConfig().dataDir, "protocols.json");
  },

  isPackaged(): boolean {
    return getConfig().isPackaged;
  },
};

export { paths as Paths };
