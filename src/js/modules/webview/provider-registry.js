import { config as chatgpt } from "./providers/chatgpt/config.js";
import { config as grok } from "./providers/grok/config.js";
import { config as gemini } from "./providers/gemini/config.js";

const providers = {
  chatgpt,
  grok,
  gemini,
};

export const ProviderRegistry = {
  get(id) {
    return providers[id] || null;
  },
  getAll() {
    return Object.values(providers);
  },
  getIds() {
    return Object.keys(providers);
  },
};
