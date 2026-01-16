import { loadSettings, saveSettings } from "../settings-manager.js";
import { registerHandler } from "./ipc-helpers.js";

export function setupSettingsHandlers() {
  registerHandler("load-settings", async (event, ...args) => {
    return await loadSettings(event, ...args);
  });

  registerHandler("save-settings", async (event, ...args) => {
    return await saveSettings(event, ...args);
  });
}
