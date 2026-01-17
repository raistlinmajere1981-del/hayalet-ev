import { loadSettings, saveSettings } from "../settings-manager.js";
import { registerHandler } from "./ipc-helpers.js";

export function setupSettingsHandlers() {
  registerHandler("load-settings", async (_event) => {
    return await loadSettings();
  });

  registerHandler("save-settings", async (_event, settings) => {
    return await saveSettings(settings);
  });
}
