import * as chatgptProvider from "./providers/chatgpt/index.js";
import * as grokProvider from "./providers/grok/index.js";
import * as geminiProvider from "./providers/gemini/index.js";

const providers = {
  chatgpt: chatgptProvider,
  grok: grokProvider,
  gemini: geminiProvider,
};

/**
 * Returns the provider module for the given provider ID.
 * @param {string} providerId - The ID of the provider (e.g., 'chatgpt', 'grok', 'gemini').
 * @returns {any} - The provider module.
 */
export function getProvider(providerId) {
  return providers[providerId];
}
