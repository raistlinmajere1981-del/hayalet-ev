import { Logger } from "../logger/index.js";
import { LogCategory } from "@shared/logging-core";

interface ElectronApiSettingsBridge {
  loadSettings?: () => Promise<unknown>;
  saveSettings?: (settings: Record<string, unknown>) => Promise<boolean>;
}

function getElectronAPI(): ElectronApiSettingsBridge | null {
  return typeof window !== "undefined" ? (window.electronAPI ?? null) : null;
}

export async function ipcLoadSettings(): Promise<unknown> {
  const api = getElectronAPI();
  if (api === null || typeof api.loadSettings !== "function") {
    Logger.error(LogCategory.SETTINGS, "electronAPI.loadSettings not available!");
    throw new Error("electronAPI.loadSettings not available");
  }
  return await api.loadSettings();
}

export async function ipcSaveSettings(settings: Record<string, unknown>): Promise<boolean> {
  const api = getElectronAPI();
  if (api === null || typeof api.saveSettings !== "function") {
    Logger.error(LogCategory.SETTINGS, "electronAPI.saveSettings not available!");
    throw new Error("electronAPI.saveSettings not available");
  }
  return await api.saveSettings(settings);
}
