import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";

import DeviceManager from "../device-manager.js";
import type { CommandPayload } from "./utils.js";
import { parseArgs, logCommandResult } from "./utils.js";
import { getErrorMessage } from '@shared/index.js';

type CommandHandlerResult = { success: boolean; message?: string; [key: string]: unknown };

export async function deviceManagerHandler(payload: CommandPayload = {}): Promise<CommandHandlerResult> {
  const providerRaw = typeof payload.provider === "string" ? payload.provider : "AI";
  const rawArgs = typeof payload.args === "string" ? payload.args : "";
  const parsedParts = parseArgs(rawArgs);
  const parts: string[] = Array.isArray(parsedParts)
    ? parsedParts.map((part) => String(part))
    : [];
  const action = (parts[0] ?? "").toLowerCase();
  const params = parts.slice(1);
  const argsLabel = rawArgs;
  const sender = typeof payload.sender === "string" && payload.sender !== ""
    ? payload.sender
    : providerRaw;
  
  try {
    Logger.panel(LogCategory.COMMAND, LogLevel.INFO, `DeviceManager çağrıldı | action=${action} args=${params.join(",")}`);
    
    let res: { success: boolean; message?: string } = { success: false, message: "no-action" };
    
    if (action === "move" || action === "movemouse") {
      const x = Number(params[0] ?? 0);
      const y = Number(params[1] ?? 0);
      res = (await DeviceManager.moveMouse(x, y)) as { success: boolean; message?: string };
    } else if (action === "click") {
      const btn = Number(params[0] ?? 1);
      res = (await DeviceManager.click(btn)) as { success: boolean; message?: string };
    } else if (action === "mousedown") {
      const btn = Number(params[0] ?? 1);
      res = (await DeviceManager.clickHold(btn)) as { success: boolean; message?: string };
    } else if (action === "mouseup") {
      const btn = Number(params[0] ?? 1);
      res = (await DeviceManager.clickRelease(btn)) as { success: boolean; message?: string };
    } else if (action === "rightclick" || action === "rclick") {
      res = (await DeviceManager.rightClick()) as { success: boolean; message?: string };
    } else if (action === "key") {
      const k = params[0] ?? "";
      res = (await DeviceManager.key(k)) as { success: boolean; message?: string };
    } else if (action === "type" || action === "write") {
      const text = params.join(" ");
      res = (await DeviceManager.write(text)) as { success: boolean; message?: string };
    } else if (action === "copy") {
      const text = params.join(" ");
      res = (await DeviceManager.copy(text)) as { success: boolean; message?: string };
    } else if (action === "paste") {
      res = (await DeviceManager.paste()) as { success: boolean; message?: string };
    } else {
      res = { success: false, message: "unknown-device-action" };
    }

    logCommandResult("DeviceManager", {
      providerRaw,
      sender,
      args: argsLabel,
      success: res.success,
      detail: res.message ?? (res.success ? "executed" : "failed"),
    });
    
    return { success: res.success, result: res };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(LogCategory.COMMAND, LogLevel.ERROR, `DeviceManager hata: ${errMsg}`);
    return { success: false, message: errMsg };
  }
}
