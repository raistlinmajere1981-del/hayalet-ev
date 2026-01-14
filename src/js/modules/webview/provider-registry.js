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
  get(id) {
    return allProviders[id] || null;
  },
  getAll() {
    return Object.values(providers);
  },
  getIds() {
    return Object.keys(providers);
  },
  
  // Asistan provider'ları için metodlar
  getAsistan(id) {
    return asistanProviders[id] || null;
  },
  getAllAsistan() {
    return Object.values(asistanProviders);
  },
  getAsistanIds() {
    return Object.keys(asistanProviders);
  },
  
  // Tüm provider'lar (AI + Asistan)
  getAny(id) {
    return allProviders[id] || null;
  },
  getAllAny() {
    return Object.values(allProviders);
  },
  getAllAnyIds() {
    return Object.keys(allProviders);
  },
  
  // Provider türünü kontrol et
  isAsistan(id) {
    return id in asistanProviders;
  },
};
