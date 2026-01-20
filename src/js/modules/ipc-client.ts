/**
 * IPC Client - Type-Safe IPC Wrapper
 * 
 * Bu modül renderer process'ten main process'e type-safe IPC çağrıları yapmayı sağlar.
 * 
 * @example
 * import { IPC } from "./ipc-client.js";
 * 
 * // Type-safe çağrı - params ve result tipleri otomatik
 * const result = await IPC.invoke("db-get-conversations", { accountId: "123" });
 * if (result.success) {
 *   console.log(result.data); // DbConversation[] tipinde
 * }
 * 
 * // Hata durumunda null döner
 * const safeResult = await IPC.safeInvoke("db-get-messages", { accountId: "123", conversationId: "456" });
 */

import { LogManager } from "./log-manager.js";
import { getErrorMessage } from "../types/index.js";
import type { IPCChannel, IPCParams, IPCResult } from "../types/ipc-channels.js";

// ============================================================================
// Types
// ============================================================================

interface ElectronAPI {
  invoke: (channel: string, params?: unknown) => Promise<unknown>;
  send: (channel: string, params?: unknown) => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

// ============================================================================
// IPC Client Class
// ============================================================================

class IPCClientClass {
  private _api: ElectronAPI | null = null;

  /**
   * ElectronAPI referansını al (lazy init)
   */
  private get api(): ElectronAPI {
    if (!this._api) {
      const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
      if (!electronAPI) {
        throw new Error("electronAPI not available - preload script may not have loaded");
      }
      this._api = electronAPI;
    }
    return this._api;
  }

  /**
   * Type-safe IPC invoke
   * 
   * @param channel - IPC kanal adı
   * @param params - Kanal parametreleri (tip otomatik)
   * @returns Promise<Result> - Kanal sonucu (tip otomatik)
   * @throws Error - IPC hatası durumunda
   * 
   * @example
   * const result = await IPC.invoke("db-get-conversations", { accountId: "123" });
   */
  async invoke<T extends IPCChannel>(
    channel: T,
    ...args: IPCParams<T> extends void ? [] : [IPCParams<T>]
  ): Promise<IPCResult<T>> {
    const params = args[0];
    return this.api.invoke(channel, params) as Promise<IPCResult<T>>;
  }

  /**
   * Safe IPC invoke - hata durumunda null döner, exception fırlatmaz
   * 
   * @param channel - IPC kanal adı
   * @param params - Kanal parametreleri
   * @returns Promise<Result | null> - Sonuç veya null
   * 
   * @example
   * const result = await IPC.safeInvoke("db-get-messages", { accountId: "123", conversationId: "456" });
   * if (result) {
   *   // result tipi otomatik
   * }
   */
  async safeInvoke<T extends IPCChannel>(
    channel: T,
    ...args: IPCParams<T> extends void ? [] : [IPCParams<T>]
  ): Promise<IPCResult<T> | null> {
    try {
      const params = args[0];
      return await this.api.invoke(channel, params) as IPCResult<T>;
    } catch (error) {
      LogManager.addEvent("ipc-client", "error", `IPC invoke failed: ${channel} - ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * IPC send (fire-and-forget)
   * 
   * @param channel - IPC kanal adı
   * @param params - Kanal parametreleri
   */
  send<T extends IPCChannel>(
    channel: T,
    ...args: IPCParams<T> extends void ? [] : [IPCParams<T>]
  ): void {
    const params = args[0];
    this.api.send(channel, params);
  }

  /**
   * IPC event listener
   * 
   * @param channel - IPC kanal adı
   * @param callback - Event callback
   * @returns Unsubscribe fonksiyonu
   */
  on<T extends IPCChannel>(
    channel: T,
    callback: (result: IPCResult<T>) => void
  ): () => void {
    return this.api.on(channel, (data) => callback(data as IPCResult<T>));
  }

  /**
   * ElectronAPI mevcut mu kontrol et
   */
  isAvailable(): boolean {
    return !!(window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
  }
}

/**
 * Singleton IPC Client instance
 */
export const IPC = new IPCClientClass();

// ============================================================================
// Convenience Functions (Legacy Support)
// ============================================================================

/**
 * Legacy support: Doğrudan invoke
 * @deprecated IPC.invoke() kullanın
 */
export async function ipcInvoke<T extends IPCChannel>(
  channel: T,
  params?: IPCParams<T>
): Promise<IPCResult<T>> {
  const client = IPC as unknown as { api: { invoke: (c: string, p?: unknown) => Promise<unknown> } };
  return client.api.invoke(channel, params) as Promise<IPCResult<T>>;
}

/**
 * Legacy support: Safe invoke
 * @deprecated IPC.safeInvoke() kullanın
 */
export async function ipcSafeInvoke<T extends IPCChannel>(
  channel: T,
  params?: IPCParams<T>
): Promise<IPCResult<T> | null> {
  try {
    const client = IPC as unknown as { api: { invoke: (c: string, p?: unknown) => Promise<unknown> } };
    return await client.api.invoke(channel, params) as IPCResult<T>;
  } catch {
    return null;
  }
}
