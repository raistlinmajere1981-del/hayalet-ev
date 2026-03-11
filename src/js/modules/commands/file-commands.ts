import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";

import { WebviewManager } from "../webview-manager.js";
import type { CommandPayload } from "./utils.js";
import { parseArgs, logCommandResult } from "./utils.js";
import { getErrorMessage } from '@shared/index.js';

type CommandHandlerResult = { success: boolean; message?: string; [key: string]: unknown };

export async function listFilesHandler(payload: CommandPayload = {}): Promise<CommandHandlerResult> {
  const providerRaw = typeof payload.provider === "string" ? payload.provider : "AI";
  const rawArgs = typeof payload.args === "string" ? payload.args : "";
  const parsedParts = parseArgs(rawArgs);
  const parts: string[] = Array.isArray(parsedParts)
    ? parsedParts.map((part) => String(part))
    : [];
  const scope = (parts[0] ?? "project").toLowerCase();
  const argsLabel = rawArgs !== "" ? rawArgs : scope;
  const sender = typeof payload.sender === "string" && payload.sender !== ""
    ? payload.sender
    : providerRaw;
  const isTestMode = payload.testMode === true;

  try {
    if (isTestMode) {
      const message = `Test modu: ListFiles sonucu kullanıcıya raporlandi | scope: ${scope}`;
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

    Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `ListFiles başlatılıyor | scope: ${scope}`);

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error("electronAPI mevcut değil");
    }

    const exclude = scope === "project" 
      ? ["node_modules", "dist", ".vite"] 
      : undefined;
      
    const treeResult = (await electronApi.generateTree(
      scope === "project" ? "." : scope,
      { exclude },
    )) as { success: boolean; message?: string; path?: string; fileName?: string; lines?: number } | undefined;

    if (treeResult?.success !== true) {
      throw new Error(treeResult?.message ?? "Tree generation failed");
    }

    const treePath = treeResult.path ?? "";
    const fileName = treeResult.fileName ?? "tree.txt";
    const lines = treeResult.lines ?? 0;

      try {
        await WebviewManager.send({
          provider: providerRaw,
          text: `Dosya Listesi (${scope}): ${lines} satır`,
        attachments: [
          {
            name: fileName,
            path: treePath,
          },
        ],
        });
        Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `ListFiles gönderildi -> ${providerRaw} | ${fileName}`);
        Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `CoreEngine -> ${providerRaw} gönderim tetiklendi`, {
          eventType: "coreengine-ai-send",
          provider: providerRaw,
          triggerCommand: "ListFiles",
          triggerSource: payload.source ?? "manual",
          detail: `${fileName} (${lines} satır)`,
          timestamp: new Date().toLocaleString("tr-TR"),
        });
      } catch (err) {
        Logger.debug(LogCategory.COMMAND, `ListFiles gönderilemedi: ${getErrorMessage(err)}`);
      }

    logCommandResult("ListFiles", {
      providerRaw,
      sender,
      args: argsLabel,
      success: true,
      detail: `${lines} lines, ${fileName}`,
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
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, `ListFiles hata: ${errMsg}`);
    
    logCommandResult("ListFiles", {
      providerRaw,
      sender,
      args: argsLabel,
      success: false,
      detail: errMsg,
    });
    
    return { success: false, message: errMsg };
  }
}
