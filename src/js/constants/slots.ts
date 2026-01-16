/**
 * Slot ve Provider sabitleri
 */

// Ana AI slotları (kullanıcı tarafından atanan)
export const SLOTS = {
  AI1: "ai1",
  AI2: "ai2",
};

export const SLOT_LIST = Object.values(SLOTS);

// Asistan slotu (AI0) - ayrı yönetiliyor
export const ASISTAN_SLOT = "ai0";

// Tüm slotlar (AI0 dahil)
export const ALL_SLOTS = {
  AI0: "ai0",
  AI1: "ai1",
  AI2: "ai2",
};

export const ALL_SLOT_LIST = Object.values(ALL_SLOTS);

// Ana AI provider'ları
export const PROVIDERS = {
  CHATGPT: "chatgpt",
  GEMINI: "gemini",
  GROK: "grok",
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

// Asistan provider'ları
export const ASISTAN_PROVIDERS = {
  OPENCODE: "opencode",
};

export const ASISTAN_PROVIDER_LIST = Object.values(ASISTAN_PROVIDERS);

// Tüm provider'lar
export const ALL_PROVIDERS = {
  ...PROVIDERS,
  ...ASISTAN_PROVIDERS,
};

export const ALL_PROVIDER_LIST = Object.values(ALL_PROVIDERS);

export const SPECIAL_PAGES = ["settings", "archives", "webview", "asistan"];
