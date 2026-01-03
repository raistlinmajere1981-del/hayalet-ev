// SettingsContext - `SettingsManager` üzerine kurulmuş paylaşılan ayar deposu
import { SettingsManager } from "./settings-manager.js";

class SettingsContextClass {
  constructor() {
    this.settings = null;
    this.listeners = [];
  }

  async init() {
    this.settings = await SettingsManager.load();
    this.notify();
    return this.settings;
  }

  async refresh() {
    this.settings = await SettingsManager.load();
    this.notify();
    return this.settings;
  }

  get(path) {
    if (!path) {
      return this.settings || SettingsManager.settings;
    }
    const parts = path.split(".");
    let current = this.settings || SettingsManager.settings;
    for (const part of parts) {
      current = current?.[part];
    }
    return current;
  }

  set(path, value) {
    SettingsManager.set(path, value);
    this.settings = SettingsManager.settings;
    this.notify();
    return this.settings;
  }

  subscribe(listener) {
    if (typeof listener === "function") {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.settings || SettingsManager.settings);
      } catch (err) {
        console.warn("SettingsContext listener error:", err);
      }
    });
  }
}

export const SettingsContext = new SettingsContextClass();
