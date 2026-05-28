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

  async invoke<T extends IPCChannel>(channel: T, params?: IPCParams<T>): Promise<IPCResult<T>> {
    return await (this.api.invoke(channel, params) as Promise<IPCResult<T>>);
  }

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

  send<T extends IPCChannel>(channel: T, params?: IPCParams<T>): void {
    this.api.send(channel, params);
  }

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
