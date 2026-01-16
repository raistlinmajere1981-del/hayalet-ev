import { ipcMain } from "electron";

/**
 * Defensive IPC Handler Wrapper
 * @param {Function} handlerFn
 * @returns {Function}
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
 * @param {Function} handler
 */
export const registerHandler = (channel, handler) => {
  ipcMain.handle(channel, handleIPC(handler));
};
