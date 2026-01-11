
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function defaultSettings() {
  const defaults = {
    user: { nickname: "Kullanıcı", avatarPath: "" },
    integrations: {
      googledrive: {
        clientId: "",
        clientSecret: "",
        authorizationCode: "",
        connected: false,
        account: "",
      },
    },
    accounts: [],
    slots: {
      ai1: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      ai2: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
    },
    assistants: {
      preferred: "rovodev",
      preferredMode: "terminal",
      lastConnected: null,
    },
    logging: {
      level: "info",
      verboseModules: [],
      silentModules: [],
      persistLevel: "info",
      maxMemoryLogs: 200,
      enableStateSnapshots: true,
      snapshotInterval: 60000,
    },
  };
  return defaults;
}

function mergeDefaults(obj, defaults) {
  if (!isPlainObject(obj)) return JSON.parse(JSON.stringify(defaults));
  const out = JSON.parse(JSON.stringify(defaults));
  for (const [k, v] of Object.entries(obj)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = mergeDefaults(v, out[k]);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function normalizeLegacy(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const r = raw;
  const out = {};

  if (isPlainObject(r.user)) {
    out.user = r.user;
  }

  const gd = r?.integrations?.googledrive;
  if (isPlainObject(gd)) {
    out.integrations = { googledrive: gd };
  }

  if (Array.isArray(r.accounts)) {
    out.accounts = r.accounts;
  }

  const slots = {};
  ["ai1", "ai2"].forEach((slot) => {
    const slotData = r?.slots?.[slot];
    if (!isPlainObject(slotData)) {
      return;
    }
    slots[slot] = {
      accountId: slotData.accountId ?? null,
      catchCommands:
        typeof slotData.catchCommands === "boolean"
          ? slotData.catchCommands
          : true,
      messageMethod: slotData.messageMethod || "injection",
      fileMethod: slotData.fileMethod || "dragdrop",
    };
  });
  out.slots = slots;

  return out;
}

export function normalizeSettings(raw) {
  const defaults = defaultSettings();
  const legacyNormalized = normalizeLegacy(raw);
  const merged = mergeDefaults(legacyNormalized, defaults);

  if (!Array.isArray(merged.accounts)) {
    merged.accounts = [];
  }

  for (const slot of ["ai1", "ai2"]) {
    const id = merged.slots?.[slot]?.accountId;
    if (id === "" || typeof id === "undefined") {
      merged.slots[slot].accountId = null;
    }
    if (typeof merged.slots[slot].catchCommands !== "boolean") {
      merged.slots[slot].catchCommands = true;
    }
    if (!merged.slots[slot].messageMethod) {
      merged.slots[slot].messageMethod = "injection";
    }
    if (!merged.slots[slot].fileMethod) {
      merged.slots[slot].fileMethod = "dragdrop";
    }
  }

  if (!isPlainObject(merged.integrations)) {
    merged.integrations = defaults.integrations;
  }
  if (!isPlainObject(merged.integrations.googledrive)) {
    merged.integrations.googledrive = defaults.integrations.googledrive;
  }

  if (!isPlainObject(merged.assistants)) {
    merged.assistants = defaults.assistants;
  }
  if (!merged.assistants.preferred) {
    merged.assistants.preferred = "rovodev";
  }
  if (!merged.assistants.preferredMode) {
    merged.assistants.preferredMode = "terminal";
  }

  if (!isPlainObject(merged.logging)) {
    merged.logging = defaults.logging;
  }
  if (!merged.logging.level) {
    merged.logging.level = "info";
  }
  if (!Array.isArray(merged.logging.verboseModules)) {
    merged.logging.verboseModules = [];
  }
  if (!Array.isArray(merged.logging.silentModules)) {
    merged.logging.silentModules = [];
  }
  if (!merged.logging.persistLevel) {
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

export function getChangedPaths(prev, next) {
  if (!prev) {
    return ["*"];
  }
  const changed = [];

  const walk = (a, b, path) => {
    if (a === b) return;
    const aObj = isPlainObject(a);
    const bObj = isPlainObject(b);
    if (aObj && bObj) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        walk(a[k], b[k], path ? `${path}.${k}` : k);
      }
      return;
    }
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr && bArr) {
      if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(path || "*");
      return;
    }
    changed.push(path || "*");
  };

  walk(prev, next, "");
  return changed.length ? changed : ["*"];
}
