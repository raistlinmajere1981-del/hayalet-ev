// Central SettingsManager (renderer)
// - Single source of truth in renderer
// - Persists via electronAPI (main)
// - Publishes realtime updates via emitter + BroadcastChannel

import { defaultSettings, migrateLegacySettings } from "./settings/settings-schema.js";
import { Emitter, createSettingsBroadcast } from "./settings/settings-events.js";
import { ipcLoadSettings, ipcSaveSettings } from "./settings/settings-ipc.js";

function deepClone(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

function setByPath(obj, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return obj;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

class SettingsManagerClass {
  constructor() {
    this._settings = defaultSettings();
    this._loaded = false;
    this._emitter = new Emitter();
    this._broadcast = createSettingsBroadcast("hayalet-settings");
    this._stopBroadcast = this._broadcast.on((msg) => {
      if (!msg || msg.type !== "settings-changed") return;
      // Avoid loops: only accept if payload differs
      if (msg.payload && typeof msg.payload === "object") {
        this._settings = migrateLegacySettings(msg.payload);
        this._loaded = true;
        this._emitter.emit(this._settings);
      }
    });
  }

  get settings() {
    return this._settings;
  }

  async load(options = {}) {
    const force = !!options.force;
    if (this._loaded && !force) return this._settings;
    const loaded = await ipcLoadSettings();
    this._settings = migrateLegacySettings(loaded);
    this._loaded = true;
    this._emitter.emit(this._settings);
    // also broadcast to keep other pages in sync
    this._broadcast.post({ type: "settings-changed", payload: this._settings });
    return this._settings;
  }

  async reload() {
    return await this.load({ force: true });
  }

  get(path) {
    if (!path) return this._settings;
    const parts = String(path).split(".");
    let cur = this._settings;
    for (const p of parts) cur = cur?.[p];
    return cur;
  }

  subscribe(listener) {
    return this._emitter.on(listener);
  }

  async save(nextSettings) {
    const payload = migrateLegacySettings(nextSettings);
    this._settings = payload;
    this._loaded = true;
    await ipcSaveSettings(payload);
    // local + app-wide notifications
    this._emitter.emit(this._settings);
    this._broadcast.post({ type: "settings-changed", payload: this._settings });
    return true;
  }

  async set(path, value) {
    const next = deepClone(this._settings);
    setByPath(next, path, value);
    return await this.save(next);
  }

  async patch(fnOrPartial) {
    const next = deepClone(this._settings);
    if (typeof fnOrPartial === "function") {
      fnOrPartial(next);
    } else if (fnOrPartial && typeof fnOrPartial === "object") {
      Object.assign(next, fnOrPartial);
    }
    return await this.save(next);
  }

  async reset() {
    return await this.save(defaultSettings());
  }
}

export const SettingsManager = new SettingsManagerClass();
