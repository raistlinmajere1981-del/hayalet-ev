import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";

import { WebviewManager } from "../webview-manager.js";
import type { CommandPayload } from "./utils.js";
import { commandRuntimeT, formatCommandTimestamp, parseArgs, logCommandResult } from "./utils.js";
import { getErrorMessage } from "@shared/index.js";

type CommandHandlerResult = { success: boolean; message?: string; [key: string]: unknown };

export async function listFilesHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const providerRaw = typeof payload.provider === "string" ? payload.provider : "AI";
  const rawArgs = typeof payload.args === "string" ? payload.args : "";
  const parsedParts = parseArgs(rawArgs);
  const parts: string[] = Array.isArray(parsedParts) ? parsedParts.map((part) => String(part)) : [];
  const scope = (parts[0] ?? "project").toLowerCase();
  const argsLabel = rawArgs !== "" ? rawArgs : scope;
  const sender =
    typeof payload.sender === "string" && payload.sender !== "" ? payload.sender : providerRaw;
  const isTestMode = payload.testMode === true;

  try {
    if (isTestMode) {
      const message = commandRuntimeT("testModeReported", {
        command: "ListFiles",
        detail: commandRuntimeT("scopeDetail", { scope }),
      });
      Logger.toast(LogCategory.COMMAND, LogLevel.INFO, message, {
        eventType: "command-test-mode",
        command: "ListFiles",
        provider: providerRaw,
      });
      logCommandResult("ListFiles", {
        providerRaw,
        sender,
        args: argsLabel,
        success: true,
        detail: message,
      });
      return {
        success: true,
        command: "ListFiles",
        args: argsLabel,
        detail: message,
      };
    }

    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      commandRuntimeT("listFilesStarting", { scope })
    );

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error(commandRuntimeT("apiUnavailable"));
    }

    const exclude = scope === "project" ? ["node_modules", "dist", ".vite"] : undefined;

    const treeResult = (await electronApi.generateTree(scope === "project" ? "." : scope, {
      exclude,
    })) as
      | { success: boolean; message?: string; path?: string; fileName?: string; lines?: number }
      | undefined;

    if (treeResult?.success !== true) {
      throw new Error(treeResult?.message ?? commandRuntimeT("treeGenerationFailed"));
    }

    const treePath = treeResult.path ?? "";
    const fileName = treeResult.fileName ?? "tree.txt";
    const lines = treeResult.lines ?? 0;

    try {
      await WebviewManager.send({
        provider: providerRaw,
        text: commandRuntimeT("listFilesAttachmentText", { scope, lines }),
        attachments: [
          {
            name: fileName,
            path: treePath,
          },
        ],
      });
      Logger.panel(
        LogCategory.COMMAND,
        LogLevel.INFO,
        commandRuntimeT("listFilesSent", { provider: providerRaw, fileName })
      );
      Logger.panel(
        LogCategory.COMMAND,
        LogLevel.INFO,
        commandRuntimeT("deliveryTriggered", { provider: providerRaw }),
        {
          eventType: "coreengine-ai-send",
          provider: providerRaw,
          triggerCommand: "ListFiles",
          triggerSource: payload.source ?? "manual",
          detail: commandRuntimeT("listFilesSummary", { fileName, lines }),
          timestamp: formatCommandTimestamp(),
        }
      );
    } catch (err) {
      Logger.debug(
        LogCategory.COMMAND,
        commandRuntimeT("deliveryFailed", {
          command: "ListFiles",
          message: getErrorMessage(err),
        })
      );
    }

    logCommandResult("ListFiles", {
      providerRaw,
      sender,
      args: argsLabel,
      success: true,
      detail: commandRuntimeT("listFilesSummary", { lines, fileName }),
    });

    return {
      success: true,
      command: "ListFiles",
      args: argsLabel,
      path: treePath,
      fileName,
      lines,
    };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    const localizedError = commandRuntimeT("commandError", {
      command: "ListFiles",
      message: errMsg,
    });
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, localizedError);

    logCommandResult("ListFiles", {
      providerRaw,
      sender,
      args: argsLabel,
      success: false,
      detail: localizedError,
    });

    return { success: false, message: localizedError };
  }
}
