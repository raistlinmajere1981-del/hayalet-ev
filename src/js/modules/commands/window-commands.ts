import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";
import { WindowManager } from "../window-manager.js";
import type { CommandPayload } from "./utils.js";
import { parseArgs, logCommandResult } from "./utils.js";
import { getErrorMessage } from "@shared/index.js";

type WindowCommandResult = {
  success: boolean;
  command?: string;
  args?: string;
  action?: string;
  executed?: boolean;
  message?: string;
};

function parseWindowArgs(rawArgs = ""): { action: string } {
  const parts = parseArgs(rawArgs);
  const action = (parts[0] ?? "minimize").toLowerCase();
  return { action };
}

export function windowManagerHandler(payload: CommandPayload = {}): WindowCommandResult {
  const providerRaw = payload.provider ?? "AI";
  const { action } = parseWindowArgs(payload.args ?? "");
  const argsLabel = payload.args ?? action;
  const sender = payload.sender ?? providerRaw;

  try {
    const result = WindowManager.apply(action) === true;

    Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `WindowManager çalıştı | action: ${action}`);

    logCommandResult("WindowManager", {
      providerRaw,
      sender,
      args: argsLabel,
      success: true,
      detail: `action: ${action}, success: ${String(result)}`,
    });

    return {
      success: result,
      command: "WindowManager",
      args: argsLabel,
      action,
      executed: result,
    };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, `WindowManager hata: ${errMsg}`);

    logCommandResult("WindowManager", {
      providerRaw,
      sender,
      args: argsLabel,
      success: false,
      detail: errMsg,
    });

    return { success: false, message: errMsg };
  }
}

export function minimizeHandler(payload: CommandPayload = {}): WindowCommandResult {
  return windowManagerHandler({ ...payload, args: "minimize" });
}

export function maximizeHandler(payload: CommandPayload = {}): WindowCommandResult {
  return windowManagerHandler({ ...payload, args: "fullscreen" });
}

export function restoreHandler(payload: CommandPayload = {}): WindowCommandResult {
  return windowManagerHandler({ ...payload, args: "restore" });
}

export async function restartHandler(payload: CommandPayload = {}): Promise<WindowCommandResult> {
  const providerRaw = payload.provider ?? "AI";
  const argsLabel = payload.args ?? "";
  const sender = payload.sender ?? providerRaw;

  try {
    Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `Restart başlatılıyor`);

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error("electronAPI mevcut değil");
    }

    logCommandResult("Restart", {
      providerRaw,
      sender,
      args: argsLabel,
      success: true,
      detail: "Uygulama yeniden başlatılıyor...",
    });

    await electronApi.appRestart();

    return {
      success: true,
      command: "Restart",
      message: "Uygulama yeniden başlatılıyor...",
    };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, `Restart hata: ${errMsg}`);

    logCommandResult("Restart", {
      providerRaw,
      sender,
      args: argsLabel,
      success: false,
      detail: errMsg,
    });

    return { success: false, message: errMsg };
  }
}
