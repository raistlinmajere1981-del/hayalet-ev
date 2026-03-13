import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";

import { ScreenshotManager } from "../screenshot-manager.js";
import { WebviewManager } from "../webview-manager.js";
import type { CommandPayload } from "./utils.js";
import { commandRuntimeT, formatCommandTimestamp, parseArgs, logCommandResult } from "./utils.js";
import { getFilename } from "../../constants/index.js";
import { getErrorMessage } from "@shared/index.js";

type CommandHandlerResult = { success: boolean; message?: string; [key: string]: unknown };

function parseScreenshotArgs(rawArgs = ""): { kind: string; selectorOrId: string; format: string } {
  const parts = parseArgs(rawArgs);
  const kind = (parts[0] ?? "system").toLowerCase();
  const selectorOrId = parts[1] ?? "";
  const format = parts[2] ?? "";
  return { kind, selectorOrId, format };
}

export async function screenshotManagerHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const providerRaw = payload.provider ?? "AI";
  const { kind, selectorOrId, format } = parseScreenshotArgs(payload.args ?? "");
  const isTestMode = payload.testMode === true;

  try {
    if (isTestMode) {
      const message = commandRuntimeT("testModeReported", {
        command: "ScreenshotManager",
        detail: commandRuntimeT("kindDetail", { kind }),
      });
      Logger.toast(LogCategory.COMMAND, LogLevel.INFO, message, {
        eventType: "command-test-mode",
        command: "ScreenshotManager",
        provider: providerRaw,
      });
      logCommandResult("ScreenshotManager", {
        providerRaw,
        sender: payload.sender ?? providerRaw,
        args: payload.args ?? "",
        success: true,
        detail: message,
      });
      return {
        success: true,
        command: "ScreenshotManager",
        args: payload.args ?? "",
        detail: message,
      };
    }

    let saved = "";

    if (kind === "window") {
      const formatOptions = format !== "" ? { format } : {};
      saved = await ScreenshotManager.captureWindow(Number(selectorOrId), {
        tag: `window-${selectorOrId}`,
        ...formatOptions,
      });
    } else if (kind === "region") {
      const formatOptions = format !== "" ? { format } : {};
      saved = await ScreenshotManager.captureRegion(selectorOrId, {
        tag: `region`,
        ...formatOptions,
      });
    } else {
      const formatOptions = format !== "" ? { format } : {};
      saved = await ScreenshotManager.captureSystem(selectorOrId, {
        tag: `system`,
        ...formatOptions,
      });
    }

    const argsLabel = payload.args ?? "";
    const sender = payload.sender ?? providerRaw;

    if (saved !== "") {
      Logger.panel(LogCategory.COMMAND, LogLevel.INFO, commandRuntimeT("screenshotRan", { kind }));

      try {
        await WebviewManager.send({
          provider: providerRaw,
          text: commandRuntimeT("screenshotAttachmentText", { kind }),
          attachments: [{ name: getFilename(saved), path: saved }],
        });
        Logger.panel(
          LogCategory.COMMAND,
          LogLevel.INFO,
          commandRuntimeT("screenshotSent", { provider: providerRaw, path: saved })
        );
        Logger.panel(
          LogCategory.COMMAND,
          LogLevel.INFO,
          commandRuntimeT("deliveryTriggered", { provider: providerRaw }),
          {
            eventType: "coreengine-ai-send",
            provider: providerRaw,
            triggerCommand: "ScreenshotManager",
            triggerSource: payload.source ?? "manual",
            detail: saved,
            timestamp: formatCommandTimestamp(),
          }
        );
      } catch (err) {
        Logger.debug(
          LogCategory.COMMAND,
          commandRuntimeT("deliveryFailed", {
            command: "ScreenshotManager",
            message: getErrorMessage(err),
          })
        );
      }

      logCommandResult("ScreenshotManager", {
        providerRaw,
        sender,
        args: argsLabel,
        success: true,
        detail: commandRuntimeT("screenshotSaved", { path: saved }),
      });

      return {
        success: true,
        command: "ScreenshotManager",
        args: argsLabel,
        path: saved,
      };
    }

    Logger.debug(LogCategory.COMMAND, commandRuntimeT("screenshotEmptyLog", { kind }));
    return { success: false, message: commandRuntimeT("screenshotEmpty") };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    const localizedError = commandRuntimeT("commandError", {
      command: "ScreenshotManager",
      message: errMsg,
    });
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, localizedError);

    logCommandResult("ScreenshotManager", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: payload.args ?? "",
      success: false,
      detail: localizedError,
    });

    return {
      success: false,
      message: localizedError,
    };
  }
}
