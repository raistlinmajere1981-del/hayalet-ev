/**
 * IPC Client - Type-Safe IPC Wrapper
 *
 * Provides type-safe IPC calls from the renderer process to the main process.
 *
 * @example
 * import { IPC } from "./ipc-client.js";
 *
 * // Type-safe call - params and result types are inferred automatically
 * const result = await IPC.invoke("db-get-conversations", { accountId: "123" });
 * if (result.success) {
 *   // result.data is typed as DbConversation[]
 * }
 *
 * // Returns null on error
 * const safeResult = await IPC.safeInvoke("db-get-messages", { accountId: "123", conversationId: "456" });
 */

import { Logger, LogCategory } from "./logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import type { IPCChannel, IPCParams, IPCResult } from "@shared/ipc-channels.js";
import { AppI18n } from "./i18n/index.js";

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
        throw new Error(AppI18n.t("app.logs.ipcClient.apiUnavailable"));
      }
      this._api = electronAPI;
    }
    return this._api;
  }

  /**
   * Type-safe IPC invoke
   *
   * @param channel - IPC channel name
   * @param params - Channel params (typed automatically)
   * @returns Promise<Result> - Channel result (typed automatically)
   * @throws Error - When the IPC call fails
   *
   * @example
   * const result = await IPC.invoke("db-get-conversations", { accountId: "123" });
   */
  async invoke<T extends IPCChannel>(channel: T, params?: IPCParams<T>): Promise<IPCResult<T>> {
    return await (this.api.invoke(channel, params) as Promise<IPCResult<T>>);
  }

  /**
   * Safe IPC invoke - returns null on error and never throws.
   *
   * @param channel - IPC channel name
   * @param params - Channel params
   * @returns Promise<Result | null> - Result or null
   *
   * @example
   * const result = await IPC.safeInvoke("db-get-messages", { accountId: "123", conversationId: "456" });
   * if (result) {
   *   // result type is inferred automatically
   * }
   */
  async safeInvoke<T extends IPCChannel>(
    channel: T,
    params?: IPCParams<T>
  ): Promise<IPCResult<T> | null> {
    try {
      return (await this.api.invoke(channel, params)) as IPCResult<T>;
    } catch (error) {
      Logger.errorT(
        LogCategory.IPC,
        "app.logs.ipcClient.invokeFailed",
        { channel, message: getErrorMessage(error) },
        {
          error: error instanceof Error ? error : new Error(String(error)),
          context: { channel },
        }
      );
      return null;
    }
  }

  /**
   * IPC send (fire-and-forget)
   *
   * @param channel - IPC channel name
   * @param params - Channel params
   */
  send<T extends IPCChannel>(channel: T, params?: IPCParams<T>): void {
    this.api.send(channel, params);
  }

  /**
   * IPC event listener
   *
   * @param channel - IPC channel name
   * @param callback - Event callback
   * @returns Unsubscribe function
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
