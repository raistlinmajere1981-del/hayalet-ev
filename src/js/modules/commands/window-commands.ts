import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";
import { WindowManager } from "../window-manager.js";
import type { CommandPayload } from "./utils.js";
import { commandRuntimeT, parseArgs, logCommandResult } from "./utils.js";
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
    const status = result ? commandRuntimeT("logSuccess") : commandRuntimeT("logError");

    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      commandRuntimeT("windowManagerRan", { action })
    );

    logCommandResult("WindowManager", {
      providerRaw,
      sender,
      args: argsLabel,
      success: true,
      detail: commandRuntimeT("windowActionResult", { action, status }),
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
    const localizedError = commandRuntimeT("commandError", {
      command: "WindowManager",
      message: errMsg,
    });
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, localizedError);

    logCommandResult("WindowManager", {
      providerRaw,
      sender,
      args: argsLabel,
      success: false,
      detail: localizedError,
    });

    return { success: false, message: localizedError };
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
    Logger.panel(LogCategory.COMMAND, LogLevel.INFO, commandRuntimeT("restartStarting"));

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error(commandRuntimeT("apiUnavailable"));
    }

    logCommandResult("Restart", {
      providerRaw,
      sender,
      args: argsLabel,
      success: true,
      detail: commandRuntimeT("restartRequested"),
    });

    await electronApi.appRestart();

    return {
      success: true,
      command: "Restart",
      message: commandRuntimeT("restartRequested"),
    };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    const localizedError = commandRuntimeT("commandError", {
      command: "Restart",
      message: errMsg,
    });
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, localizedError);

    logCommandResult("Restart", {
      providerRaw,
      sender,
      args: argsLabel,
      success: false,
      detail: localizedError,
    });

    return { success: false, message: localizedError };
  }
}
