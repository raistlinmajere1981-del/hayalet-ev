import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";

import { ScreenshotManager } from "../screenshot-manager.js";
import { WebviewManager } from "../webview-manager.js";
import type { CommandPayload } from "./utils.js";
import { parseArgs, logCommandResult } from "./utils.js";
import { getFilename } from "../../constants/index.js";
import { getErrorMessage } from '@shared/index.js';

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
      const message = `Test modu: ScreenshotManager sonucu kullanıcıya raporlandi | kind: ${kind}`;
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
      Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `ScreenshotManager çalıştı | kind: ${kind}`);
      
      try {
        await WebviewManager.send({
          provider: providerRaw,
          text: `Ekran görüntüsü: ${kind}`,
          attachments: [
            { name: getFilename(saved), path: saved },
          ],
        });
        Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `ScreenshotManager gönderildi -> ${providerRaw} | ${saved}`);
        Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `CoreEngine -> ${providerRaw} gönderim tetiklendi`, {
          eventType: "coreengine-ai-send",
          provider: providerRaw,
          triggerCommand: "ScreenshotManager",
          triggerSource: payload.source ?? "manual",
          detail: saved,
          timestamp: new Date().toLocaleString("tr-TR"),
        });
      } catch (err) {
        Logger.debug(LogCategory.COMMAND, `ScreenshotManager gönderilemedi: ${getErrorMessage(err)}`);
      }
      
      logCommandResult("ScreenshotManager", {
        providerRaw,
        sender,
        args: argsLabel,
        success: true,
        detail: `Kaydedildi: ${saved}`,
      });
      
      return {
        success: true,
        command: "ScreenshotManager",
        args: argsLabel,
        path: saved,
      };
    }

    Logger.debug(LogCategory.COMMAND, `ScreenshotManager çalıştı fakat sonuç boş | kind: ${kind}`);
    return { success: false, message: "Screenshot alınamadı" };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, `ScreenshotManager hata: ${errMsg}`);
    
    logCommandResult("ScreenshotManager", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: payload.args ?? "",
      success: false,
      detail: errMsg,
    });
    
    return {
      success: false,
      message: errMsg,
    };
  }
}
