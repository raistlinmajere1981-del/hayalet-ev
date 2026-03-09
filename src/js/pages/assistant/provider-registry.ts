/**
 * Assistant provider registry.
 *
 * Manages provider adapters used on the Assistant page.
 *
 * To add a new provider:
 * 1. Create an adapter that implements `AssistantProviderAdapter`
 * 2. Import it in this file and register it with `registerAdapter()`
 */

import type { AssistantProviderAdapter } from "@shared/assistant.js";
import { OpenCodeAdapter } from "./opencode-adapter.js";
import { OpenCodeUiAdapter } from "./opencode-ui-adapter.js";

const adapters = new Map<string, AssistantProviderAdapter>();

// Register default adapters.
function initDefaults(): void {
  registerAdapter(new OpenCodeAdapter());
  registerAdapter(new OpenCodeUiAdapter());
}

/**
 * Registers a new assistant provider adapter.
 */
export function registerAdapter(adapter: AssistantProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

/**
 * Returns the adapter for a provider ID.
 */
export function getAdapter(providerId: string): AssistantProviderAdapter | null {
  return adapters.get(providerId) ?? null;
}

/**
 * Returns all registered adapters.
 */
export function getAllAdapters(): AssistantProviderAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Returns registered adapter IDs.
 */
export function getAdapterIds(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Checks whether an adapter is registered.
 */
export function hasAdapter(providerId: string): boolean {
  return adapters.has(providerId);
}

// Register default adapters on first load.
initDefaults();

const assistantProviderRegistry = {
  registerAdapter,
  getAdapter,
  getAllAdapters,
  getAdapterIds,
  hasAdapter,
};

export { assistantProviderRegistry as AssistantProviderRegistry };
