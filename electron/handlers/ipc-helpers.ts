import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import type { IpcHandler, IpcResult } from "@electron/types";
import { LoggerCore } from "../logger/core/LoggerCore.js";
import { getLoggerCore } from "../logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import type { LogEntry } from "@shared/index.js";

const logger = getLoggerCore();

export const handleIPC =
  <Args extends unknown[], R>(handlerFn: IpcHandler<Args, R>) =>
  async (event: IpcMainInvokeEvent, ...args: Args): Promise<R | IpcResult> => {
    try {
      return await handlerFn(event, ...args);
    } catch (err) {
      await logger.logInternalT(
        LogCategory.IPC,
        LogLevel.ERROR,
        "electron.ipc.logs.handlerError",
        { message: (err as Error).message },
        {
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        }
      );
      return {
        success: false,
        error: (err as Error).message,
        code: "IPC_ERROR",
      };
    }
  };

export const registerHandler = <Args extends unknown[], R>(
  channel: string,
  handler: IpcHandler<Args, R>
): void => {
  ipcMain.handle(channel, handleIPC(handler));
};

export const handleLoggerAppendBatch = async (
  _event: IpcMainInvokeEvent,
  entries: unknown[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const logger = LoggerCore.getInstance();
    await logger.handleBatch(_event, {
      entries: entries as LogEntry[],
      sessionId: "",
      batchTimestamp: new Date().toISOString(),
      processSource: "renderer",
    });
    return { success: true };
  } catch (err) {
    await logger.logInternalT(
      LogCategory.IPC,
      LogLevel.ERROR,
      "electron.ipc.logs.loggerBatchAppendFailed",
      { message: (err as Error).message },
      {
        entriesCount: Array.isArray(entries) ? entries.length : 0,
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
    return {
      success: false,
      error: (err as Error).message,
    };
  }
};
