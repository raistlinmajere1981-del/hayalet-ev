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
  loadOpenCodeModels as _loadOpenCodeModels,
  getAgentModelPreference,
  saveAgentModelPreference,
  saveAgentPreference,
  saveModelPreference,
  getActiveProjects,
  addActiveProject,
  removeActiveProject,
  type OpenCodeConfig,
  type OpenCodePreferences,
  type OpenCodeProviderInfo,
  type AgentModelPreference,
} from "../opencode-config-manager.ts";
import { OpenCodeManager } from "../opencode-manager.ts";

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
   * Get available models from OpenCode Server API
   * Endpoint: GET /config.providers
   */
  registerHandler("opc-list-models", async (): Promise<OpenCodeProviderInfo[]> => {
    try {
      const apiResult = await OpenCodeManager.getProviders();
      
      if (!apiResult.success) {
        console.error("[IPC:OpenCode] Failed to fetch models from API:", apiResult.error);
        return [];
      }
      
      if (!apiResult.data?.providers?.length) {
        console.warn("[IPC:OpenCode] API returned empty provider list");
        return [];
      }
      
      const providers: OpenCodeProviderInfo[] = apiResult.data.providers.map(provider => ({
        id: provider.id,
        name: provider.name,
        models: Object.entries(provider.models || {}).map(([modelId, model]) => ({
          id: `${provider.id}/${modelId}`,
          name: model.name || modelId,
          providerId: provider.id,
          context: model.limit?.context,
          output: model.limit?.output,
        })),
      }));
      
      console.log(`[IPC:OpenCode] Loaded ${providers.length} providers from API`, {
        totalModels: providers.reduce((sum, p) => sum + p.models.length, 0)
      });
      
      return providers;
    } catch (err) {
      console.error("[IPC:OpenCode] Error fetching models:", err);
      return [];
    }
  });
  
  /**
   * Get available agents - tries multiple sources in order:
   * 1. OpenCode Server API (app.agents) - most up-to-date
   * 2. CLI (opencode agent list) - fallback
   */
  registerHandler("opc-list-agents", async (): Promise<Array<{name: string, description?: string}>> => {
    // 1. Önce OpenCode Server API'den çek
    try {
      const apiResult = await OpenCodeManager.getAgents();
      if (apiResult.success && Array.isArray(apiResult.data) && apiResult.data.length > 0) {
        console.log(`[IPC:OpenCode] Loaded ${apiResult.data.length} agents from API`);
        return apiResult.data;
      }
    } catch (apiErr) {
      console.warn("[IPC:OpenCode] API agent fetch failed, trying CLI...", apiErr);
    }

    // 2. CLI'dan dene (fallback)
    try {
      const { execSync } = await import("child_process");
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
      
      if (agents.length > 0) {
        console.log(`[IPC:OpenCode] Loaded ${agents.length} agents from CLI`);
        return agents;
      }
    } catch (cliErr) {
      console.error("[IPC:OpenCode] CLI agent fetch failed:", cliErr);
    }
    
    // Fallback: default agent
    console.log("[IPC:OpenCode] Using default agent");
    return [{ name: "coder", description: "Default coding agent" }];
  });

  // ===========================================================================
  // Agent/Model Preference Persistence
  // ===========================================================================

  /**
   * Get saved agent/model preference for a folder
   */
  registerHandler("opc-get-agent-model-preference", async (
    _event,
    folderPath?: string
  ): Promise<AgentModelPreference | null> => {
    try {
      const preference = await getAgentModelPreference(folderPath);
      console.log(`[IPC:OpenCode] Get preference for ${folderPath || 'default'}:`, preference);
      return preference;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to get agent/model preference:", error);
      return null;
    }
  });

  /**
   * Save agent/model preference for a folder
   */
  registerHandler("opc-save-agent-model-preference", async (
    _event,
    preference: Omit<AgentModelPreference, 'lastUpdated'>,
    folderPath?: string
  ): Promise<boolean> => {
    try {
      const success = await saveAgentModelPreference(preference, folderPath);
      console.log(`[IPC:OpenCode] Save preference for ${folderPath || 'default'}:`, success);
      return success;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to save agent/model preference:", error);
      return false;
    }
  });

  /**
   * Save only agent preference
   */
  registerHandler("opc-save-agent-preference", async (
    _event,
    agent: string,
    folderPath?: string
  ): Promise<boolean> => {
    try {
      const success = await saveAgentPreference(agent, folderPath);
      console.log(`[IPC:OpenCode] Save agent preference: ${agent} for ${folderPath || 'default'}`);
      return success;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to save agent preference:", error);
      return false;
    }
  });

  /**
   * Save only model preference
   */
  registerHandler("opc-save-model-preference", async (
    _event,
    providerId: string,
    modelId: string,
    folderPath?: string
  ): Promise<boolean> => {
    try {
      const success = await saveModelPreference(providerId, modelId, folderPath);
      console.log(`[IPC:OpenCode] Save model preference: ${providerId}/${modelId} for ${folderPath || 'default'}`);
      return success;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to save model preference:", error);
      return false;
    }
  });

  // ===========================================================================
  // Active Projects Management
  // ===========================================================================

  /**
   * Get active projects list
   */
  registerHandler("opc-get-active-projects", async (): Promise<string[]> => {
    try {
      const projects = await getActiveProjects();
      console.log(`[IPC:OpenCode] Get active projects:`, projects);
      return projects;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to get active projects:", error);
      return [process.cwd()];
    }
  });

  /**
   * Add a project to active projects
   */
  registerHandler("opc-add-active-project", async (
    _event,
    projectPath: string
  ): Promise<string[]> => {
    try {
      const projects = await addActiveProject(projectPath);
      console.log(`[IPC:OpenCode] Added active project: ${projectPath}`);
      return projects;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to add active project:", error);
      return [];
    }
  });

  /**
   * Remove a project from active projects
   */
  registerHandler("opc-remove-active-project", async (
    _event,
    projectPath: string
  ): Promise<string[]> => {
    try {
      const projects = await removeActiveProject(projectPath);
      console.log(`[IPC:OpenCode] Removed active project: ${projectPath}`);
      return projects;
    } catch (error) {
      console.error("[IPC:OpenCode] Failed to remove active project:", error);
      return [];
    }
  });
  
  console.log("[IPC:OpenCode] Handlers registered");
}
