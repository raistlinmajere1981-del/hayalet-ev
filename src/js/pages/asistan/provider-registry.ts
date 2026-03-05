/**
 * Asistan Provider Registry
 *
 * Asistan sayfasındaki provider adapter'ları yönetir.
 *
 * Yeni provider eklemek için:
 * 1. `AsistanProviderAdapter` interface'ini implement eden bir adapter oluşturun
 * 2. Bu dosyada import edip `registerAdapter()` ile kaydedin
 */

import type { AsistanProviderAdapter } from "@shared/asistan.js";
import { OpenCodeAdapter } from "./opencode-adapter.js";
import { OpenCodeUiAdapter } from "./opencode-ui-adapter.js";

const adapters = new Map<string, AsistanProviderAdapter>();

// Default adapter'ları kaydet
function initDefaults(): void {
  registerAdapter(new OpenCodeAdapter());
  registerAdapter(new OpenCodeUiAdapter());
}

/**
 * Yeni bir asistan provider adapter'ı kaydet
 */
export function registerAdapter(adapter: AsistanProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

/**
 * Provider ID'ye göre adapter getir
 */
export function getAdapter(providerId: string): AsistanProviderAdapter | null {
  return adapters.get(providerId) ?? null;
}

/**
 * Tüm kayıtlı adapter'ları getir
 */
export function getAllAdapters(): AsistanProviderAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Kayıtlı adapter ID'lerini getir
 */
export function getAdapterIds(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Adapter kayıtlı mı?
 */
export function hasAdapter(providerId: string): boolean {
  return adapters.has(providerId);
}

// İlk yüklemede default adapter'ları kaydet
initDefaults();

const asistanProviderRegistry = {
  registerAdapter,
  getAdapter,
  getAllAdapters,
  getAdapterIds,
  hasAdapter,
};

export { asistanProviderRegistry as AsistanProviderRegistry };
