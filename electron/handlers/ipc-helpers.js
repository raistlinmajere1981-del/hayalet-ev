import { ipcMain } from "electron";

/**
 * @typedef {import('electron').IpcMainInvokeEvent} IpcMainInvokeEvent
 * @typedef {(event: IpcMainInvokeEvent, ...args: any[]) => any} IpcHandler
 */

/**
 * Defensive IPC Handler Wrapper
 * @param {IpcHandler} handlerFn
 * @returns {(event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>}
 */
export const handleIPC =
  (handlerFn) =>
  async (event, ...args) => {
    try {
      return await handlerFn(event, ...args);
    } catch (err) {
      console.error("[IPC Error]", err);
      return {
        success: false,
        error: err.message || String(err),
        code: "IPC_ERROR",
      };
    }
  };

/**
 * Register handlers with defensive wrapper
 * @param {string} channel
 * @param {IpcHandler} handler
 */
export const registerHandler = (channel, handler) => {
  ipcMain.handle(channel, handleIPC(handler));
};
