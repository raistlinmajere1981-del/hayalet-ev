import { config as chatgpt } from "./providers/chatgpt/config.js";
import { config as grok } from "./providers/grok/config.js";
import { config as gemini } from "./providers/gemini/config.js";
import { config as opencode } from "./providers/opencode/config.js";
import { config as opencodeUi } from "./providers/opencode-ui/config.js";

const providers = {
  chatgpt,
  grok,
  gemini,
};

const asistanProviders = {
  opencode,
  "opencode-ui": opencodeUi,
};

const allProviders = {
  ...providers,
  ...asistanProviders,
};

function updateProviderMaps(id: string, config: unknown): void {
  const record = config as Record<string, unknown>;
  if (id in providers) {
    (providers as Record<string, Record<string, unknown>>)[id] = record;
  }

  if (id in asistanProviders) {
    (asistanProviders as Record<string, Record<string, unknown>>)[id] = record;
  }

  (allProviders as Record<string, Record<string, unknown>>)[id] = record;
}

const providerRegistry = {
  /**
   * Provider config'i getir (AI + Asistan)
   * @param {string} id - Provider ID (chatgpt, grok, gemini, opencode, opencode-ui)
   * @returns {Object|null}
   */
  get(id: string): Record<string, unknown> | null {
    return allProviders[id as keyof typeof allProviders] ?? null;
  },

  /**
   * Sadece ana AI provider'ları getir
   * @returns {Object[]}
   */
  getAll(): Record<string, unknown>[] {
    return Object.values(providers);
  },

  /**
   * Sadece ana AI provider ID'leri getir
   * @returns {string[]}
   */
  getIds(): string[] {
    return Object.keys(providers);
  },

  getAsistan(id: string): Record<string, unknown> | null {
    return asistanProviders[id as keyof typeof asistanProviders] ?? null;
  },
  getAllAsistan(): Record<string, unknown>[] {
    return Object.values(asistanProviders);
  },
  getAsistanIds(): string[] {
    return Object.keys(asistanProviders);
  },

  getAny(id: string): Record<string, unknown> | null {
    return allProviders[id as keyof typeof allProviders] ?? null;
  },
  getAllAny(): Record<string, unknown>[] {
    return Object.values(allProviders);
  },
  getAllAnyIds(): string[] {
    return Object.keys(allProviders);
  },

  update(id: string, config: unknown): void {
    updateProviderMaps(id, config);
  },

  isAsistan(id: string): boolean {
    return id in asistanProviders;
  },
};

export { providerRegistry as ProviderRegistry };
