/**
 * Provider Factory - Lazy Loading Support
 * 
 * Provider modüllerini dinamik olarak yükler.
 * İlk kullanımda yükleme yaparak startup süresini kısaltır.
 */

import { LogManager } from "../log-manager.js";

// ============================================================================
// Types
// ============================================================================

type ProviderId = "chatgpt" | "grok" | "gemini" | "opencode";

/**
 * Provider modül tipi - esnek yapı
 * Her provider kendi metodlarını export eder
 */
type ProviderModule = Record<string, unknown>;

// ============================================================================
// Provider Cache (Lazy Loading)
// ============================================================================

const providerCache: Map<ProviderId, ProviderModule> = new Map();
const loadingPromises: Map<ProviderId, Promise<ProviderModule | null>> = new Map();

/**
 * Provider modülünü lazy load et
 * @param providerId - Provider ID
 * @returns Provider modülü veya null
 */
async function loadProvider(providerId: ProviderId): Promise<ProviderModule | null> {
  // Cache'de varsa döndür
  if (providerCache.has(providerId)) {
    return providerCache.get(providerId)!;
  }

  // Zaten yükleniyor mu kontrol et (prevent duplicate loads)
  if (loadingPromises.has(providerId)) {
    return loadingPromises.get(providerId)!;
  }

  // Yükleme promise'i oluştur
  const loadPromise = (async () => {
    try {
      let module: ProviderModule;
      
      switch (providerId) {
        case "chatgpt":
          module = await import("./providers/chatgpt/index.js");
          break;
        case "grok":
          module = await import("./providers/grok/index.js");
          break;
        case "gemini":
          module = await import("./providers/gemini/index.js");
          break;
        case "opencode":
          module = await import("./providers/opencode/index.js");
          break;
        default:
          LogManager.addEvent("provider-factory", "warn", `Unknown provider: ${providerId}`);
          return null;
      }

      // Cache'e ekle
      providerCache.set(providerId, module);
      LogManager.addEvent("provider-factory", "debug", `Provider loaded: ${providerId}`, { visibility: 3 });
      return module;
    } catch (error) {
      LogManager.addEvent("provider-factory", "error", `Failed to load provider ${providerId}: ${error}`);
      return null;
    } finally {
      // Loading promise'i temizle
      loadingPromises.delete(providerId);
    }
  })();

  loadingPromises.set(providerId, loadPromise);
  return loadPromise;
}

// ============================================================================
// Eager Loading (Backward Compatibility)
// ============================================================================

// Startup'ta tüm provider'ları yükle (eski davranış)
import * as chatgptProvider from "./providers/chatgpt/index.js";
import * as grokProvider from "./providers/grok/index.js";
import * as geminiProvider from "./providers/gemini/index.js";
import * as opencodeProvider from "./providers/opencode/index.js";

// Cache'i startup'ta doldur
providerCache.set("chatgpt", chatgptProvider);
providerCache.set("grok", grokProvider);
providerCache.set("gemini", geminiProvider);
providerCache.set("opencode", opencodeProvider);

// Ana AI provider'ları (legacy)
const providers = {
  chatgpt: chatgptProvider,
  grok: grokProvider,
  gemini: geminiProvider,
};

// Asistan provider'ları (legacy)
const asistanProviders = {
  opencode: opencodeProvider,
};

// Tüm provider'lar (legacy)
const allProviders = {
  ...providers,
  ...asistanProviders,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Returns the provider module for the given provider ID (sync - legacy).
 * Searches in all providers (AI + Asistan).
 * @deprecated Use getProviderAsync for lazy loading support
 */
export function getProvider(providerId: keyof typeof allProviders) {
  return allProviders[providerId];
}

/**
 * Returns the provider module for the given provider ID (async - lazy loading).
 * Use this for new code to benefit from lazy loading.
 * 
 * @example
 * const provider = await getProviderAsync("chatgpt");
 * if (provider) {
 *   await provider.sendMessage(webview, "Hello");
 * }
 */
async function getProviderAsync(providerId: ProviderId): Promise<ProviderModule | null> {
  return loadProvider(providerId);
}

/**
 * Provider yüklü mü kontrol et
 */
function isProviderLoaded(providerId: ProviderId): boolean {
  return providerCache.has(providerId);
}

/**
 * Tüm provider'ları preload et (startup optimization için)
 */
async function preloadAllProviders(): Promise<void> {
  const ids: ProviderId[] = ["chatgpt", "grok", "gemini", "opencode"];
  await Promise.all(ids.map(id => loadProvider(id)));
}

/**
 * Provider cache'ini temizle (testing için)
 */
function clearProviderCache(): void {
  providerCache.clear();
}
