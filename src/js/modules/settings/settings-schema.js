// Central settings schema + helpers
// Keep this file small and dependency-free.

export function defaultSettings() {
  return {
    human: { nickname: "Kullanıcı", avatarPath: "" },
    ai1: {
      providerId: "chatgpt",
      catchCommands: true,
      messageMethod: "injection",
      fileMethod: "dragdrop",
      activeAccountId: null,
    },
    ai2: {
      providerId: "grok",
      catchCommands: true,
      messageMethod: "injection",
      fileMethod: "dragdrop",
      activeAccountId: null,
    },
    general: { messageMethod: "injection", fileMethod: "dragdrop" },
    accounts: [],
  };
}

export function migrateLegacySettings(raw) {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== "object") return defaults;
  const payload = { ...raw };

  // legacy slot keys
  if (!payload.ai1 && payload.chatgpt) payload.ai1 = payload.chatgpt;
  if (!payload.ai2 && payload.grok) payload.ai2 = payload.grok;
  delete payload.chatgpt;
  delete payload.grok;

  payload.human = { ...defaults.human, ...(payload.human || {}) };
  payload.ai1 = { ...defaults.ai1, ...(payload.ai1 || {}) };
  payload.ai2 = { ...defaults.ai2, ...(payload.ai2 || {}) };
  payload.general = { ...defaults.general, ...(payload.general || {}) };

  if (typeof payload.ai1.activeAccountId === "undefined") payload.ai1.activeAccountId = null;
  if (typeof payload.ai2.activeAccountId === "undefined") payload.ai2.activeAccountId = null;

  if (!Array.isArray(payload.accounts)) payload.accounts = [];

  return payload;
}
