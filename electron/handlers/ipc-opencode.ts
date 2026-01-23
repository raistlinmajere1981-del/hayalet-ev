/**
 * IPC Handlers - OpenCode Native UI
 * 
 * Workspace selection, filesystem browsing, native dialogs
 * için IPC handler'ları.
 */

import { dialog, BrowserWindow } from "electron";
import { readdir, stat } from "fs/promises";
import { join, dirname, basename } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { registerHandler } from "./ipc-helpers.ts";
import {
  loadOpencodeConfig,
  saveOpencodeConfig,
  addRecentFolder,
  removeRecentFolder,
  addOpencodeBinary,
  removeOpencodeBinary,
  updateOpencodePreferences,
  recordWorkspaceLaunch,
  loadOpenCodeModels,
  type OpenCodeConfig,
  type OpenCodePreferences,
  type OpenCodeProviderInfo,
} from "../opencode-config-manager.ts";

// =============================================================================
// Types
// =============================================================================

interface FileSystemEntry {
  name: string;
  path: string;
  absolutePath?: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
}

type FileSystemScope = "restricted" | "unrestricted";
type FileSystemPathKind = "relative" | "absolute" | "drives";

interface FileSystemListingMetadata {
  scope: FileSystemScope;
  currentPath: string;
  parentPath?: string;
  rootPath: string;
  homePath: string;
  displayPath: string;
  pathKind: FileSystemPathKind;
}

interface FileSystemListResponse {
  entries: FileSystemEntry[];
  metadata: FileSystemListingMetadata;
}

interface NativeDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<"openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles">;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Dizin içeriğini listele
 */
async function listDirectory(
  dirPath: string,
  includeFiles: boolean = false
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  
  try {
    const items = await readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      // Hidden dosyaları atla (. ile başlayanlar)
      if (item.name.startsWith(".")) continue;
      
      const isDirectory = item.isDirectory();
      
      // Sadece directory istenmişse ve bu directory değilse atla
      if (!includeFiles && !isDirectory) continue;
      
      const fullPath = join(dirPath, item.name);
      
      try {
        const stats = await stat(fullPath);
        
        entries.push({
          name: item.name,
          path: item.name,
          absolutePath: fullPath,
          type: isDirectory ? "directory" : "file",
          size: isDirectory ? undefined : stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      } catch {
        // stat başarısız olursa basic bilgiyle ekle
        entries.push({
          name: item.name,
          path: item.name,
          absolutePath: fullPath,
          type: isDirectory ? "directory" : "file",
        });
      }
    }
    
    // Alfabetik sıralama (directories first)
    entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
  } catch (err) {
    console.error(`[IPC:OpenCode] Error listing directory ${dirPath}:`, err);
    throw err;
  }
  
  return entries;
}

/**
 * Path'in parent'ını hesapla
 */
function getParentPath(currentPath: string): string | undefined {
  const parent = dirname(currentPath);
  // Root'a ulaştıysak parent yok
  if (parent === currentPath) return undefined;
  return parent;
}

/**
 * Path'i güzel görüntüleme formatına çevir
 */
function getDisplayPath(absolutePath: string, homeDir: string): string {
  if (absolutePath.startsWith(homeDir)) {
    return "~" + absolutePath.slice(homeDir.length);
  }
  return absolutePath;
}

// =============================================================================
// IPC Handlers Setup
// =============================================================================

export function setupOpencodeHandlers(): void {
  // =========================================================================
  // Config Management
  // =========================================================================
  
  /**
   * OpenCode config'i yükle
   */
  registerHandler("opc-load-config", async (): Promise<OpenCodeConfig> => {
    return loadOpencodeConfig();
  });
  
  /**
   * OpenCode config'i kaydet
   */
  registerHandler("opc-save-config", async (_event, config: OpenCodeConfig): Promise<boolean> => {
    return saveOpencodeConfig(config);
  });
  
  /**
   * Recent folder ekle
   */
  registerHandler("opc-add-recent-folder", async (_event, path: string, name?: string): Promise<OpenCodeConfig> => {
    return addRecentFolder(path, name);
  });
  
  /**
   * Recent folder kaldır
   */
  registerHandler("opc-remove-recent-folder", async (_event, path: string): Promise<OpenCodeConfig> => {
    return removeRecentFolder(path);
  });
  
  /**
   * OpenCode binary ekle
   */
  registerHandler("opc-add-binary", async (_event, path: string, version?: string): Promise<OpenCodeConfig> => {
    return addOpencodeBinary(path, version);
  });
  
  /**
   * OpenCode binary kaldır
   */
  registerHandler("opc-remove-binary", async (_event, path: string): Promise<OpenCodeConfig> => {
    return removeOpencodeBinary(path);
  });
  
  /**
   * Preferences güncelle
   */
  registerHandler("opc-update-preferences", async (_event, updates: Partial<OpenCodePreferences>): Promise<OpenCodeConfig> => {
    return updateOpencodePreferences(updates);
  });
  
  /**
   * Workspace launch kaydı
   */
  registerHandler("opc-record-launch", async (_event, folderPath: string, binaryPath?: string): Promise<OpenCodeConfig> => {
    return recordWorkspaceLaunch(folderPath, binaryPath);
  });

  // =========================================================================
  // Native Dialog
  // =========================================================================
  
  /**
   * Native folder selection dialog aç
   */
  registerHandler("opc-open-folder-dialog", async (_event, options?: NativeDialogOptions): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow();
    
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options?.title || "Select Workspace Folder",
      defaultPath: options?.defaultPath || homedir(),
      buttonLabel: options?.buttonLabel || "Select",
      properties: ["openDirectory", "showHiddenFiles"],
    };
    
    const result = win 
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  });
  
  /**
   * Native file selection dialog aç
   */
  registerHandler("opc-open-file-dialog", async (_event, options?: NativeDialogOptions): Promise<string[] | null> => {
    const win = BrowserWindow.getFocusedWindow();
    
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options?.title || "Select File",
      defaultPath: options?.defaultPath || homedir(),
      buttonLabel: options?.buttonLabel || "Select",
      filters: options?.filters,
      properties: options?.properties || ["openFile"],
    };
    
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths;
  });

  // =========================================================================
  // Filesystem Browsing (Custom Dialog Fallback)
  // =========================================================================
  
  /**
   * Filesystem listing - custom directory browser için
   */
  registerHandler("opc-list-filesystem", async (
    _event, 
    targetPath?: string, 
    options?: { includeFiles?: boolean }
  ): Promise<FileSystemListResponse> => {
    const homeDir = homedir();
    const currentPath = targetPath || homeDir;
    
    // Path'in var olup olmadığını kontrol et
    if (!existsSync(currentPath)) {
      throw new Error(`Path does not exist: ${currentPath}`);
    }
    
    const entries = await listDirectory(currentPath, options?.includeFiles ?? false);
    const parentPath = getParentPath(currentPath);
    
    const metadata: FileSystemListingMetadata = {
      scope: "unrestricted",
      currentPath,
      parentPath,
      rootPath: "/",
      homePath: homeDir,
      displayPath: getDisplayPath(currentPath, homeDir),
      pathKind: "absolute",
    };
    
    return { entries, metadata };
  });
  
  /**
   * Path validasyonu - dizin var mı ve erişilebilir mi?
   */
  registerHandler("opc-validate-path", async (_event, targetPath: string): Promise<{
    valid: boolean;
    isDirectory: boolean;
    error?: string;
  }> => {
    try {
      if (!existsSync(targetPath)) {
        return { valid: false, isDirectory: false, error: "Path does not exist" };
      }
      
      const stats = await stat(targetPath);
      return { valid: true, isDirectory: stats.isDirectory() };
    } catch (err) {
      return { valid: false, isDirectory: false, error: (err as Error).message };
    }
  });
  
  /**
   * Home directory path'ini al
   */
  registerHandler("opc-get-home-path", async (): Promise<string> => {
    return homedir();
  });
  
  /**
   * Path join helper
   */
  registerHandler("opc-join-path", async (_event, ...segments: string[]): Promise<string> => {
    return join(...segments);
  });
  
  /**
   * Path bilgilerini al (dirname, basename)
   */
  registerHandler("opc-path-info", async (_event, targetPath: string): Promise<{
    dirname: string;
    basename: string;
    exists: boolean;
  }> => {
    return {
      dirname: dirname(targetPath),
      basename: basename(targetPath),
      exists: existsSync(targetPath),
    };
  });
  
  // =========================================================================
  // OpenCode CLI Integration (Agent & Model Lists)
  // =========================================================================
  
  /**
   * Get available models from OpenCode system config
   * Reads from: ~/.config/opencode/opencode.json
   * Falls back to CLI if config not found
   */
  registerHandler("opc-list-models", async (): Promise<OpenCodeProviderInfo[]> => {
    try {
      // Önce config dosyasından oku
      const providers = await loadOpenCodeModels();
      
      if (providers.length > 0) {
        console.log(`[IPC:OpenCode] Loaded ${providers.length} providers from config`);
        return providers;
      }
      
      // Config boşsa CLI'dan dene (fallback)
      console.log("[IPC:OpenCode] Config empty, trying CLI fallback...");
      const { execSync } = await import("child_process");
      
      const output = execSync("opencode models", { 
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"]
      });
      
      // Parse CLI output - each line is "provider/model" format
      const modelsByProvider = new Map<string, OpenCodeProviderInfo>();
      
      output
        .split("\n")
        .map(line => line.trim())
        .filter(line => line && line.includes("/"))
        .forEach(line => {
          const [providerId, ...modelParts] = line.split("/");
          const modelId = modelParts.join("/");
          
          if (!modelsByProvider.has(providerId)) {
            modelsByProvider.set(providerId, {
              id: providerId,
              name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
              models: [],
            });
          }
          
          modelsByProvider.get(providerId)!.models.push({
            id: line,
            name: modelId || line,
            providerId,
          });
        });
      
      return Array.from(modelsByProvider.values());
    } catch (err) {
      console.error("[IPC:OpenCode] Error listing models:", err);
      return [];
    }
  });
  
  /**
   * Get available agents from OpenCode CLI
   * Runs: opencode agent list
   */
  registerHandler("opc-list-agents", async (): Promise<Array<{name: string, description?: string}>> => {
    const { execSync } = await import("child_process");
    try {
      const output = execSync("opencode agent list", { 
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"]
      });
      
      // Parse output - agent names are at the start of lines (before optional descriptions)
      // Format: "agentName (flags)\n  permissions..."
      const agents: Array<{name: string, description?: string}> = [];
      const lines = output.split("\n");
      
      for (const line of lines) {
        // Agent lines start without whitespace and contain agent name
        if (line && !line.startsWith(" ") && !line.startsWith("[") && !line.startsWith("{")) {
          const match = line.match(/^(\w+)(?:\s*\(([^)]+)\))?/);
          if (match) {
            agents.push({
              name: match[1],
              description: match[2] || undefined,
            });
          }
        }
      }
      
      return agents.length > 0 ? agents : [{ name: "coder", description: "Default coding agent" }];
    } catch (err) {
      console.error("[IPC:OpenCode] Error listing agents:", err);
      return [{ name: "coder", description: "Default coding agent" }];
    }
  });
  
  console.log("[IPC:OpenCode] Handlers registered");
}
