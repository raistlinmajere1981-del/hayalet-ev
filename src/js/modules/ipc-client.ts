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
 *   // result.data is typed as DbConversation[]
 * }
 *
 * // Hata durumunda null döner
 * const safeResult = await IPC.safeInvoke("db-get-messages", { accountId: "123", conversationId: "456" });
 */

import { Logger, LogCategory } from "./logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import type { IPCChannel, IPCParams, IPCResult } from "@shared/ipc-channels.js";

interface IPCElectronAPI {
  invoke: (channel: string, params?: unknown) => Promise<unknown>;
  send: (channel: string, params?: unknown) => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

function isIPCElectronAPI(api: unknown): api is IPCElectronAPI {
  if (api === undefined || api === null || typeof api !== "object") return false;
  const candidate = api as { invoke?: unknown; send?: unknown; on?: unknown };
  return (
    typeof candidate.invoke === "function" &&
    typeof candidate.send === "function" &&
    typeof candidate.on === "function"
  );
}

class IPCClientClass {
  private _api: IPCElectronAPI | null = null;

  private get api(): IPCElectronAPI {
    if (!this._api) {
      const electronAPI = window.electronAPI;
      if (!isIPCElectronAPI(electronAPI)) {
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
  async invoke<T extends IPCChannel>(channel: T, params?: IPCParams<T>): Promise<IPCResult<T>> {
    return await (this.api.invoke(channel, params) as Promise<IPCResult<T>>);
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
    params?: IPCParams<T>
  ): Promise<IPCResult<T> | null> {
    try {
      return (await this.api.invoke(channel, params)) as IPCResult<T>;
    } catch (error) {
      Logger.error(LogCategory.IPC, `IPC invoke failed: ${channel} - ${getErrorMessage(error)}`, {
        error: error instanceof Error ? error : new Error(String(error)),
        context: { channel },
      });
      return null;
    }
  }

  /**
   * IPC send (fire-and-forget)
   *
   * @param channel - IPC kanal adı
   * @param params - Kanal parametreleri
   */
  send<T extends IPCChannel>(channel: T, params?: IPCParams<T>): void {
    this.api.send(channel, params);
  }

  /**
   * IPC event listener
   *
   * @param channel - IPC kanal adı
   * @param callback - Event callback
   * @returns Unsubscribe fonksiyonu
   */
  on<T extends IPCChannel>(channel: T, callback: (result: IPCResult<T>) => void): () => void {
    return this.api.on(channel, (data) => {
      callback(data as IPCResult<T>);
    });
  }

  isAvailable(): boolean {
    return "electronAPI" in window;
  }
}

export const IPC = new IPCClientClass();
