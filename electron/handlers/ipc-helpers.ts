import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import type { IpcHandler, IpcResult } from "../types/index.ts";

/**
 * Defensive IPC Handler Wrapper
 */
export const handleIPC =
  <Args extends unknown[], R>(handlerFn: IpcHandler<Args, R>) =>
  async (event: IpcMainInvokeEvent, ...args: Args): Promise<R | IpcResult> => {
    try {
      return await handlerFn(event, ...args);
    } catch (err) {
      console.error("[IPC Error]", err);
      return {
        success: false,
        error: (err as Error).message || String(err),
        code: "IPC_ERROR",
      };
    }
  };

/**
 * Register handlers with defensive wrapper
 */
export const registerHandler = <Args extends unknown[], R>(
  channel: string,
  handler: IpcHandler<Args, R>
): void => {
  ipcMain.handle(channel, handleIPC(handler));
};
