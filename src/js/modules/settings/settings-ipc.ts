import { LogManager } from "../log-manager.js";

function getElectronAPI() {
  return typeof window !== "undefined" ? window.electronAPI : null;
}

export async function ipcLoadSettings() {
  const api = getElectronAPI();
  if (!api?.loadSettings) {
    LogManager.addEvent("settings-ipc", "error", "electronAPI.loadSettings not available!");
    throw new Error("electronAPI.loadSettings not available");
  }
  return await api.loadSettings();
}

export async function ipcSaveSettings(settings: Record<string, unknown>): Promise<boolean> {
  const api = getElectronAPI();
  if (!api?.saveSettings) {
    LogManager.addEvent("settings-ipc", "error", "electronAPI.saveSettings not available!");
    throw new Error("electronAPI.saveSettings not available");
  }
  return await api.saveSettings(settings);
}
