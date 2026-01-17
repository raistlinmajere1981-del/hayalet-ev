import { config as chatgpt } from "./providers/chatgpt/config.js";
import { config as grok } from "./providers/grok/config.js";
import { config as gemini } from "./providers/gemini/config.js";
import { config as opencode } from "./providers/opencode/config.js";

// Ana AI provider'ları
const providers = {
  chatgpt,
  grok,
  gemini,
};

// Asistan provider'ları
const asistanProviders = {
  opencode,
};

// Tüm provider'lar
const allProviders = {
  ...providers,
  ...asistanProviders,
};

export const ProviderRegistry = {
  /**
   * Provider config'i getir (AI + Asistan)
   * @param {string} id - Provider ID (chatgpt, grok, gemini, opencode)
   * @returns {Object|null}
   */
  get(id: keyof typeof allProviders) {
    return allProviders[id] || null;
  },
  
  /**
   * Sadece ana AI provider'ları getir
   * @returns {Object[]}
   */
  getAll() {
    return Object.values(providers);
  },
  
  /**
   * Sadece ana AI provider ID'leri getir
   * @returns {string[]}
   */
  getIds() {
    return Object.keys(providers);
  },
  
  // Asistan provider'ları için metodlar
  getAsistan(id: keyof typeof asistanProviders) {
    return asistanProviders[id] || null;
  },
  getAllAsistan() {
    return Object.values(asistanProviders);
  },
  getAsistanIds() {
    return Object.keys(asistanProviders);
  },
  
  // Tüm provider'lar (AI + Asistan)
  getAny(id: keyof typeof allProviders) {
    return allProviders[id] || null;
  },
  getAllAny() {
    return Object.values(allProviders);
  },
  getAllAnyIds() {
    return Object.keys(allProviders);
  },
  
  // Provider türünü kontrol et
  isAsistan(id: string) {
    return id in asistanProviders;
  },
};
