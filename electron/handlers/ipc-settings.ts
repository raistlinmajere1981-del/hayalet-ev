import { loadSettings, saveSettings } from "../settings-manager.ts";
import {
  loadOpencodeConfig,
  saveOpencodeConfig,
  addRecentFolder,
  removeRecentFolder,
  addOpencodeBinary,
  removeOpencodeBinary,
  updateOpencodePreferences,
  recordWorkspaceLaunch,
  type OpenCodeConfig,
  type OpenCodePreferences,
} from "../opencode-config-manager.ts";
import { registerHandler } from "./ipc-helpers.ts";

export function setupSettingsHandlers(): void {
  // ==================== Main Settings ====================
  registerHandler("load-settings", async (_event) => {
    return await loadSettings();
  });

  registerHandler("save-settings", async (_event, settings: unknown) => {
    return await saveSettings(settings as Record<string, unknown>);
  });

  // ==================== OpenCode Config ====================
  registerHandler("load-opencode-config", async (_event) => {
    return await loadOpencodeConfig();
  });

  registerHandler("save-opencode-config", async (_event, config: OpenCodeConfig) => {
    return await saveOpencodeConfig(config);
  });

  registerHandler("opencode-add-recent-folder", async (_event, path: string, name?: string) => {
    return await addRecentFolder(path, name);
  });

  registerHandler("opencode-remove-recent-folder", async (_event, path: string) => {
    return await removeRecentFolder(path);
  });

  registerHandler("opencode-add-binary", async (_event, path: string, version?: string) => {
    return await addOpencodeBinary(path, version);
  });

  registerHandler("opencode-remove-binary", async (_event, path: string) => {
    return await removeOpencodeBinary(path);
  });

  registerHandler("opencode-update-preferences", async (_event, updates: Partial<OpenCodePreferences>) => {
    return await updateOpencodePreferences(updates);
  });

  registerHandler("opencode-record-workspace-launch", async (_event, folderPath: string, binaryPath?: string) => {
    return await recordWorkspaceLaunch(folderPath, binaryPath);
  });
}
