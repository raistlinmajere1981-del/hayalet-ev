import type { AppSettings, SlotSettings, MessageMethod, UploadMethod } from "@shared/settings.js";
import { isAsistanProviderId } from "@shared/common.js";
import {
  DEFAULT_ASISTAN_ACCOUNT_ID,
  DEFAULT_OPENCODE_UI_ACCOUNT_ID,
  createDefaultAsistanAccount,
  createDefaultOpencodeUiAccount,
  createDefaultSettings,
} from "@shared/settings-defaults.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v);
}

function normalizeAppLanguage(value: unknown): "tr" | "en" {
  return value === "en" ? "en" : "tr";
}

export function defaultSettings(): AppSettings {
  return createDefaultSettings();
}

function mergeDefaults(obj: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  if (!isPlainObject(obj)) return JSON.parse(JSON.stringify(defaults)) as Record<string, unknown>;
  const out = JSON.parse(JSON.stringify(defaults)) as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = mergeDefaults(v, out[k]);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function normalizeLegacy(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return {};
  }

  const r = raw as Partial<AppSettings>;
  const out: Partial<AppSettings> = {};

  if (isPlainObject(r.user)) {
    out.user = r.user;
  }

  if (isPlainObject(r.general)) {
    out.general = r.general;
  }

  const gd = r.integrations?.googledrive;
  if (isPlainObject(gd)) {
    out.integrations = { googledrive: gd };
  }

  if (Array.isArray(r.accounts)) {
    out.accounts = r.accounts;
  }

  if (Array.isArray(r.asistanAccounts)) {
    out.asistanAccounts = r.asistanAccounts;
  }

  const slots: { ai1?: SlotSettings; ai2?: SlotSettings; [key: string]: SlotSettings | undefined } =
    {};
  ["ai1", "ai2"].forEach((slot) => {
    const slotData = r.slots?.[slot];
    if (!isPlainObject(slotData)) {
      return;
    }
    slots[slot] = {
      accountId: slotData.accountId ?? null,
      catchCommands: typeof slotData.catchCommands === "boolean" ? slotData.catchCommands : true,
      disabledCommands: Array.isArray(slotData.disabledCommands)
        ? slotData.disabledCommands.filter((item): item is string => typeof item === "string")
        : [],
      resumeLastSession:
        typeof slotData.resumeLastSession === "boolean" ? slotData.resumeLastSession : true,
      rememberConnectionStatus:
        typeof slotData.rememberConnectionStatus === "boolean"
          ? slotData.rememberConnectionStatus
          : false,
      lastConnectionState:
        slotData.lastConnectionState === "connected" ||
        slotData.lastConnectionState === "disconnected"
          ? slotData.lastConnectionState
          : "disconnected",
      messageMethod: ((slotData.messageMethod as string | undefined) ??
        "injection") as MessageMethod,
      fileMethod: ((slotData.fileMethod as string | undefined) ?? "dragdrop") as UploadMethod,
    };
  });
  out.slots = slots as { ai1: SlotSettings; ai2: SlotSettings; [key: string]: SlotSettings };

  if (isPlainObject(r.asistanSlot)) {
    out.asistanSlot = {
      accountId: r.asistanSlot.accountId ?? null,
      catchCommands:
        typeof r.asistanSlot.catchCommands === "boolean" ? r.asistanSlot.catchCommands : false,
      disabledCommands: Array.isArray(r.asistanSlot.disabledCommands)
        ? r.asistanSlot.disabledCommands.filter((item): item is string => typeof item === "string")
        : [],
      messageMethod: r.asistanSlot.messageMethod ?? "injection",
      fileMethod: r.asistanSlot.fileMethod ?? "injection",
    };
  }

  if (isPlainObject(r.assistants)) {
    out.assistants = r.assistants;
  }

  if (isPlainObject(r.logging)) {
    out.logging = r.logging;
  }

  return out;
}

export function normalizeSettings(raw: unknown): AppSettings {
  const defaults = defaultSettings();
  const legacyNormalized = normalizeLegacy(raw);

  const merged = mergeDefaults(legacyNormalized, defaults) as AppSettings;

  if (!Array.isArray(merged.accounts)) {
    merged.accounts = [];
  }

  if (!isPlainObject(merged.general)) {
    merged.general = defaults.general ?? { language: "tr" };
  }
  merged.general.language = normalizeAppLanguage(merged.general.language);

  if (!Array.isArray(merged.asistanAccounts)) {
    merged.asistanAccounts = [createDefaultAsistanAccount(), createDefaultOpencodeUiAccount()];
  } else if (merged.asistanAccounts.length === 0) {
    merged.asistanAccounts = [createDefaultAsistanAccount(), createDefaultOpencodeUiAccount()];
  } else {
    // Ensure default asistan accounts exist
    if (
      !merged.asistanAccounts.find((a: { id: string }) => a.id === DEFAULT_OPENCODE_UI_ACCOUNT_ID)
    ) {
      merged.asistanAccounts.splice(1, 0, createDefaultOpencodeUiAccount());
    }
    if (!merged.asistanAccounts.find((a: { id: string }) => a.id === DEFAULT_ASISTAN_ACCOUNT_ID)) {
      merged.asistanAccounts.unshift(createDefaultAsistanAccount());
    }
  }

  merged.asistanAccounts.forEach((account) => {
    const dbPath = (account as { dbPath?: unknown }).dbPath;
    if (typeof dbPath !== "string" && dbPath !== null && dbPath !== undefined) {
      (account as { dbPath?: string | null }).dbPath = null;
    }
  });

  for (const slot of ["ai1", "ai2"] as const) {
    const id = merged.slots[slot].accountId;
    if (id === "" || typeof id === "undefined") {
      merged.slots[slot].accountId = null;
    }
    if (typeof merged.slots[slot].catchCommands !== "boolean") {
      merged.slots[slot].catchCommands = true;
    }
    if (!Array.isArray(merged.slots[slot].disabledCommands)) {
      merged.slots[slot].disabledCommands = [];
    }
    if (typeof merged.slots[slot].resumeLastSession !== "boolean") {
      merged.slots[slot].resumeLastSession = true;
    }
    if (typeof merged.slots[slot].rememberConnectionStatus !== "boolean") {
      merged.slots[slot].rememberConnectionStatus = false;
    }
    if (
      merged.slots[slot].lastConnectionState !== "connected" &&
      merged.slots[slot].lastConnectionState !== "disconnected"
    ) {
      merged.slots[slot].lastConnectionState = "disconnected";
    }
    merged.slots[slot].messageMethod ??= "injection";
    merged.slots[slot].fileMethod ??= "dragdrop";
  }

  if (!isPlainObject(merged.asistanSlot)) {
    merged.asistanSlot = defaults.asistanSlot ?? {
      accountId: DEFAULT_ASISTAN_ACCOUNT_ID,
      catchCommands: false,
      disabledCommands: [],
      messageMethod: "injection",
      fileMethod: "injection",
    };
  }
  if (merged.asistanSlot.accountId === "" || typeof merged.asistanSlot.accountId === "undefined") {
    merged.asistanSlot.accountId = DEFAULT_ASISTAN_ACCOUNT_ID;
  }
  if (typeof merged.asistanSlot.catchCommands !== "boolean") {
    merged.asistanSlot.catchCommands = false;
  }
  if (!Array.isArray(merged.asistanSlot.disabledCommands)) {
    merged.asistanSlot.disabledCommands = [];
  }
  merged.asistanSlot.messageMethod ??= "injection";
  merged.asistanSlot.fileMethod ??= "injection";

  if (!isPlainObject(merged.integrations)) {
    merged.integrations = defaults.integrations ?? {};
  }
  if (!isPlainObject(merged.integrations.googledrive)) {
    if (defaults.integrations?.googledrive) {
      merged.integrations.googledrive = defaults.integrations.googledrive;
    } else {
      delete merged.integrations.googledrive;
    }
  }

  if (!isPlainObject(merged.assistants)) {
    merged.assistants = defaults.assistants ?? {};
  }
  if (!isAsistanProviderId(merged.assistants.preferred)) {
    merged.assistants.preferred = "opencode";
  }
  if (typeof merged.assistants.resumeLastSession !== "boolean") {
    merged.assistants.resumeLastSession = true;
  }
  if (typeof merged.assistants.keepServersOnAppClose !== "boolean") {
    merged.assistants.keepServersOnAppClose = false;
  }
  if (
    typeof merged.assistants.lastOpencodeUrl !== "string" &&
    merged.assistants.lastOpencodeUrl !== null
  ) {
    merged.assistants.lastOpencodeUrl = null;
  }
  if (
    typeof merged.assistants.lastOpencodeUiSessionId !== "string" &&
    merged.assistants.lastOpencodeUiSessionId !== null
  ) {
    merged.assistants.lastOpencodeUiSessionId = null;
  }
  if (
    !isAsistanProviderId(merged.assistants.lastConnected) &&
    merged.assistants.lastConnected !== null
  ) {
    merged.assistants.lastConnected = null;
  }
  if (
    typeof merged.assistants.lastActiveRelay !== "string" &&
    merged.assistants.lastActiveRelay !== null
  ) {
    merged.assistants.lastActiveRelay = null;
  }
  if (!Array.isArray(merged.assistants.disabledMcpServers)) {
    merged.assistants.disabledMcpServers = [];
  }
  if (!isPlainObject(merged.assistants.opencode)) {
    merged.assistants.opencode = defaults.assistants?.opencode ?? {
      binaryPath: null,
      defaultPort: 4096,
    };
  }
  if (
    typeof merged.assistants.opencode.binaryPath !== "string" &&
    merged.assistants.opencode.binaryPath !== null
  ) {
    merged.assistants.opencode.binaryPath = null;
  }
  if (
    typeof merged.assistants.opencode.binaryPath === "string" &&
    merged.assistants.opencode.binaryPath.trim() === ""
  ) {
    merged.assistants.opencode.binaryPath = null;
  }
  if (
    typeof merged.assistants.opencode.defaultPort !== "number" ||
    Number.isInteger(merged.assistants.opencode.defaultPort) !== true ||
    merged.assistants.opencode.defaultPort < 1024 ||
    merged.assistants.opencode.defaultPort > 65535
  ) {
    merged.assistants.opencode.defaultPort = 4096;
  }
  if (
    typeof merged.assistants.opencode.version !== "string" &&
    merged.assistants.opencode.version !== null
  ) {
    merged.assistants.opencode.version = null;
  }
  if (
    typeof merged.assistants.opencode.version === "string" &&
    merged.assistants.opencode.version.trim() === ""
  ) {
    merged.assistants.opencode.version = null;
  }
  if (!isPlainObject(merged.assistants.opencodeUi)) {
    merged.assistants.opencodeUi = defaults.assistants?.opencodeUi ?? {
      hiddenProviders: [],
      hiddenModels: [],
      favoriteModels: [],
      defaultModelKey: null,
      lastSelectedModelKey: null,
    };
  }
  if (!Array.isArray(merged.assistants.opencodeUi.hiddenProviders)) {
    merged.assistants.opencodeUi.hiddenProviders = [];
  }
  if (!Array.isArray(merged.assistants.opencodeUi.hiddenModels)) {
    merged.assistants.opencodeUi.hiddenModels = [];
  }
  if (!Array.isArray(merged.assistants.opencodeUi.favoriteModels)) {
    merged.assistants.opencodeUi.favoriteModels = [];
  }
  if (
    typeof merged.assistants.opencodeUi.defaultModelKey !== "string" &&
    merged.assistants.opencodeUi.defaultModelKey !== null
  ) {
    merged.assistants.opencodeUi.defaultModelKey = null;
  }
  if (
    typeof merged.assistants.opencodeUi.lastSelectedModelKey !== "string" &&
    merged.assistants.opencodeUi.lastSelectedModelKey !== null
  ) {
    merged.assistants.opencodeUi.lastSelectedModelKey = null;
  }
  if (
    typeof merged.assistants.opencodeUi.defaultModelKey === "string" &&
    merged.assistants.opencodeUi.defaultModelKey.trim() === ""
  ) {
    merged.assistants.opencodeUi.defaultModelKey = null;
  }
  if (
    typeof merged.assistants.opencodeUi.lastSelectedModelKey === "string" &&
    merged.assistants.opencodeUi.lastSelectedModelKey.trim() === ""
  ) {
    merged.assistants.opencodeUi.lastSelectedModelKey = null;
  }

  if (!isPlainObject(merged.logging)) {
    merged.logging = defaults.logging ?? {};
  }
  if (merged.logging.level === undefined || merged.logging.level === "") {
    merged.logging.level = "info";
  }
  if (!Array.isArray(merged.logging.verboseModules)) {
    merged.logging.verboseModules = [];
  }
  if (!Array.isArray(merged.logging.silentModules)) {
    merged.logging.silentModules = [];
  }
  if (merged.logging.persistLevel === undefined || merged.logging.persistLevel === "") {
    merged.logging.persistLevel = "info";
  }
  if (typeof merged.logging.maxMemoryLogs !== "number") {
    merged.logging.maxMemoryLogs = 200;
  }
  if (typeof merged.logging.enableStateSnapshots !== "boolean") {
    merged.logging.enableStateSnapshots = true;
  }
  if (typeof merged.logging.snapshotInterval !== "number") {
    merged.logging.snapshotInterval = 60000;
  }

  return merged;
}

export function getChangedPaths(prev: unknown, next: unknown): string[] {
  if (prev === null || prev === undefined) {
    return ["*"];
  }
  const changed: string[] = [];

  const walk = (a: unknown, b: unknown, path: string): void => {
    if (a === b) return;
    const aObj = isPlainObject(a);
    const bObj = isPlainObject(b);
    if (aObj && bObj) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        walk(a[k], b[k], path !== "" ? `${path}.${k}` : k);
      }
      return;
    }
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr && bArr) {
      if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(path !== "" ? path : "*");
      return;
    }
    changed.push(path !== "" ? path : "*");
  };

  walk(prev, next, "");
  return changed.length > 0 ? changed : ["*"];
}
