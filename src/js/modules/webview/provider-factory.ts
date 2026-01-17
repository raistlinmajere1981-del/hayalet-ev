import * as chatgptProvider from "./providers/chatgpt/index.js";
import * as grokProvider from "./providers/grok/index.js";
import * as geminiProvider from "./providers/gemini/index.js";
import * as opencodeProvider from "./providers/opencode/index.js";

// Ana AI provider'ları
const providers = {
  chatgpt: chatgptProvider,
  grok: grokProvider,
  gemini: geminiProvider,
};

// Asistan provider'ları
const asistanProviders = {
  opencode: opencodeProvider,
};

// Tüm provider'lar
const allProviders = {
  ...providers,
  ...asistanProviders,
};

/**
 * Returns the provider module for the given provider ID.
 * Searches in all providers (AI + Asistan).
 */
export function getProvider(providerId: keyof typeof allProviders) {
  return allProviders[providerId];
}
