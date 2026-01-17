
import {
  defaultSettings,
  normalizeSettings,
  getChangedPaths,
} from "./settings/settings-schema.js";
import {
  Emitter,
  createSettingsBroadcast,
} from "./settings/settings-events.js";
import { ipcLoadSettings, ipcSaveSettings } from "./settings/settings-ipc.js";
import { LogManager } from "./log-manager.js";

function deepClone<T>(obj: T): T {
  return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = String(path || "")
    .split(".")
    .filter(Boolean);
  if (!parts.length) return obj;
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

/** Settings broadcast interface */
interface SettingsBroadcast {
  on: (callback: (msg: unknown) => void) => () => void;
  post: (msg: unknown) => void;
}

 
type SettingsData = any;

class SettingsManagerClass {
  _settings: SettingsData;
  _loaded: boolean;
  _emitter: Emitter;
  _lastSaved: SettingsData;
  _broadcast: SettingsBroadcast;
  _stopBroadcast: () => void;

  constructor() {
    this._settings = defaultSettings();
    this._loaded = false;
    this._emitter = new Emitter();
    this._lastSaved = defaultSettings();
    this._broadcast = createSettingsBroadcast("hayalet-settings");
    this._stopBroadcast = this._broadcast.on((data) => {
      const msg = data as { type?: string; payload?: unknown };
      if (!msg || msg.type !== "settings-changed") {
        return;
      }
      
      if (msg.payload && typeof msg.payload === "object") {
        const next = normalizeSettings(msg.payload);
        const changedPaths = getChangedPaths(this._settings, next);
        
        this._settings = next;
        this._loaded = true;
        
        this._emitter.emit({ settings: this._settings, changedPaths });
      }
    });
  }

  getSnapshot() {
    return this._settings;
  }

  get settings() {
    return this._settings;
  }

  async load(options: { force?: boolean } = {}) {
    const force = !!options.force;
    
    if (this._loaded && !force) {
      return this._settings;
    }
    
    const loaded = await ipcLoadSettings();
    this._settings = normalizeSettings(loaded);
    
    this._lastSaved = this._settings;
    this._loaded = true;
    
    this._emitter.emit({ settings: this._settings, changedPaths: ["*"] });
    this._broadcast.post({ type: "settings-changed", payload: this._settings });
    
    return this._settings;
  }

  async reload() {
    return await this.load({ force: true });
  }

  get(path?: string) {
    if (!path) return this._settings;
    const parts = String(path).split(".");
    let cur = this._settings;
    for (const p of parts) cur = cur?.[p];
    return cur;
  }

  subscribe(listener: (event: { settings: unknown; changedPaths: string[] }) => void) {
    return this._emitter.on(listener);
  }

  async save(nextSettings: Record<string, unknown>) {
    const next = normalizeSettings(nextSettings);
    const changedPaths = getChangedPaths(this._lastSaved, next);
    
    this._settings = next;
    this._loaded = true;
    
    await ipcSaveSettings(next);
    
    this._lastSaved = next;
    
    this._emitter.emit({ settings: this._settings, changedPaths });
    this._broadcast.post({ type: "settings-changed", payload: this._settings });
    
    return true;
  }

  async set(path: string, value: unknown) {
    const next = deepClone(this._settings);
    setByPath(next, path, value);
    return await this.save(next);
  }

  async patch(fnOrPartial: ((settings: Record<string, unknown>) => void) | Record<string, unknown>) {
    const next = deepClone(this._settings);
    if (typeof fnOrPartial === "function") {
      fnOrPartial(next);
    } else if (fnOrPartial && typeof fnOrPartial === "object") {
      Object.assign(next, fnOrPartial);
    }
    return await this.save(next);
  }

  async resetToDefaults() {
    LogManager.addEvent("settings", "warning", "resetToDefaults() called - resetting all settings to default values");
    const defaults = defaultSettings();
    return await this.save(defaults);
  }
}

export const SettingsManager = new SettingsManagerClass();
