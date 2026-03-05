import { deviceActionHandler } from "./device-manager.ts";
import { screenshotCaptureHandler } from "./screenshot-manager.ts";
import { whisperLoad, whisperSave } from "./whisper-manager.ts";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { LogCategory, LogLevel } from "../src/types/logging-core.js";
import { Paths } from "./paths.ts";

const logger = getLoggerCore();
let _mainWindow: BrowserWindow | null = null;

const COMMAND_LIST = [
  "DeviceManager",
  "FileManager",
  "WebviewManager",
  "WhisperManager",
  "WindowManager",
  "ScreenshotManager",
  "TakeScreenshot",
  "PlayMusic",
  "Restart",
  "AIAIChatStart",
  "AIAIChatStop",
  "GetFile",
  "GetItDone",
  "ListFiles",
];

interface CommandPayload {
  args?: string;
  provider?: string;
  source?: string;
  sender?: string;
  [key: string]: unknown;
}

interface ServerCommandsOptions {
  mainWindow?: BrowserWindow | null;
}

const handlers: Record<string, (payload: CommandPayload) => Promise<unknown>> = {};

const defaultHandler =
  (name: string) =>
  async (
    payload: CommandPayload = {}
  ): Promise<{ success: boolean; command: string; args: string; detail: string }> => {
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.INFO,
      `Server command: ${name}`,
      { args: payload.args ?? "", payload }
    );
    return { success: true, command: name, args: payload.args ?? "", detail: "OK" };
  };

const parseArgs = (rawArgs = ""): string[] => {
  const args = typeof rawArgs === "string" ? rawArgs : "";
  const parts: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|([^,\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(args)) !== null) {
    const val = match[1] ?? match[2] ?? match[3] ?? "";
    if (val.trim() !== "") parts.push(val.trim());
  }
  return parts;
};

const parseWhisperArgs = (
  rawArgs = "",
  fallbackAccountId = ""
): { accountId: string; text: string; when: string } => {
  const parts = parseArgs(rawArgs);

  if (parts.length >= 3) {
    const [accountId, text, when] = parts;
    return {
      accountId: accountId ?? fallbackAccountId,
      text: text ?? "",
      when: when ?? "",
    };
  }

  if (parts.length === 2) {
    const [first, second] = parts;
    if (fallbackAccountId !== "") {
      return {
        accountId: fallbackAccountId,
        text: first ?? "",
        when: second ?? "",
      };
    }
    return {
      accountId: first ?? "",
      text: second ?? "",
      when: "",
    };
  }

  if (parts.length === 1) {
    const [first] = parts;
    if (fallbackAccountId !== "") {
      return {
        accountId: fallbackAccountId,
        text: first ?? "",
        when: "",
      };
    }
    return {
      accountId: first ?? "",
      text: "",
      when: "",
    };
  }

  return {
    accountId: fallbackAccountId,
    text: "",
    when: "",
  };
};

const parseScreenshotArgs = (
  rawArgs = ""
): { kind: string; selectorOrId: string; format: string } => {
  const parts = parseArgs(rawArgs);
  const kind = (parts[0] ?? "system").toLowerCase();
  const selectorOrId = parts[1] ?? "";
  const format = parts[2] ?? "";
  return { kind, selectorOrId, format };
};

const parseWindowArgs = (rawArgs = ""): { action: string } => {
  const parts = parseArgs(rawArgs);
  const action = (parts[0] ?? "minimize").toLowerCase();
  return { action };
};

COMMAND_LIST.forEach((name) => {
  if (name === "WhisperManager") return;
  handlers[name.toLowerCase()] = defaultHandler(name);
});

handlers["whispermanager"] = async (payload: CommandPayload = {}): Promise<unknown> => {
  const providerRaw = typeof payload.provider === "string" ? payload.provider : "";
  const { accountId, text, when } = parseWhisperArgs(payload.args, providerRaw);
  const argsLabel = payload.args ?? `"${accountId}","${text}","${when}"`;

  if (accountId === "" || text === "") {
    return {
      success: false,
      message: 'Kullanım: ++cmd:WhisperManager(<accountId>, "<mesaj>", "<zaman>")',
    };
  }

  try {
    const current = await whisperLoad(null, { accountId }).catch(() => ({
      pending: [] as Array<Record<string, unknown>>,
      done: [] as Array<Record<string, unknown>>,
    }));

    const pending = Array.isArray(current.pending) ? current.pending : [];
    const parsedWhen = when === "" ? Date.now() : Date.parse(when);
    const rec = {
      id: `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      accountId,
      text,
      when: Number.isFinite(parsedWhen) ? parsedWhen : Date.now(),
      createdAt: Date.now(),
      done: false,
      queued: false,
    };

    pending.push(rec);

    const saveRes = await whisperSave(null, {
      accountId,
      payload: { pending, done: current.done },
    });

    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.INFO,
      `WhisperManager added for ${accountId}`,
      { accountId, args: argsLabel, record: rec }
    );

    return {
      success: saveRes.success === true,
      command: "WhisperManager",
      args: argsLabel,
      record: rec,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `WhisperManager error: ${message}`,
      { accountId, error: err }
    );
    return { success: false, message };
  }
};

handlers["devicemanager"] = async (payload: CommandPayload = {}): Promise<unknown> => {
  try {
    const parts = parseArgs(payload.args ?? "");
    const action = (parts[0] ?? "").toLowerCase();
    const params = parts.slice(1);
    const res = await deviceActionHandler(null, action, params);

    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.INFO,
      `DeviceManager ${action}`,
      { action, params, result: res }
    );
    return { success: res.success === true, result: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `DeviceManager error: ${message}`,
      { error: err }
    );
    return { success: false, message };
  }
};

handlers["screenshotmanager"] = async (payload: CommandPayload = {}): Promise<unknown> => {
  try {
    const { kind: _kind, selectorOrId, format } = parseScreenshotArgs(payload.args ?? "");
    const options: { format?: string; region?: string } = {};
    if (format !== "") options.format = format;
    if (selectorOrId !== "") options.region = selectorOrId;
    const res = await screenshotCaptureHandler(null, options);
    if (res.success === true) {
      const savedPath = typeof res.path === "string" ? res.path : "in-memory";
      await logger.logInternal(
        LogCategory.SERVER_COMMANDS,
        LogLevel.INFO,
        `ScreenshotManager saved ${savedPath}`,
        { path: res.path, options }
      );
      return { success: true, path: res.path, dataUrl: res.dataUrl };
    }
    return { success: false, message: res.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `ScreenshotManager error: ${message}`,
      { error: err }
    );
    return { success: false, message };
  }
};

handlers["takescreenshot"] = handlers["screenshotmanager"];

handlers["windowmanager"] = async (payload: CommandPayload = {}): Promise<unknown> => {
  try {
    const { action } = parseWindowArgs(payload.args ?? "");
    if (_mainWindow === null) return { success: false, message: "no-window" };
    let result = false;
    if (action === "minimize") {
      _mainWindow.minimize();
      result = true;
    } else if (action === "fullscreen" || action === "maximize") {
      _mainWindow.setFullScreen(true);
      result = true;
    } else if (action === "restore") {
      _mainWindow.restore();
      result = true;
    }

    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.INFO,
      `WindowManager action=${action}`,
      { action, result }
    );
    return { success: result, action, executed: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `WindowManager error: ${message}`,
      { error: err }
    );
    return { success: false, message };
  }
};

handlers["restart"] = async (_payload: CommandPayload = {}): Promise<unknown> => {
  try {
    await logger.logInternal(LogCategory.SERVER_COMMANDS, LogLevel.INFO, "Restart requested", {});
    return { success: true, message: "restart requested" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `Restart error: ${message}`,
      { error: err }
    );
    return { success: false, message };
  }
};

handlers["listfiles"] = async (_payload: CommandPayload = {}): Promise<unknown> => {
  try {
    if (_mainWindow === null) return { success: false, message: "no-main-window" };
    const baseDir = Paths.getProjectRoot();
    return { success: true, command: "ListFiles", path: baseDir, fileName: "root", lines: 0 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `ListFiles error: ${message}`,
      { error: err }
    );
    return { success: false, message };
  }
};

const serverCommands = {
  init(opts: ServerCommandsOptions = {}): void {
    _mainWindow = opts.mainWindow ?? null;
  },
  async run(
    _event: IpcMainInvokeEvent | null,
    commandName: string,
    payload: CommandPayload = {}
  ): Promise<unknown> {
    const key = commandName.toLowerCase();
    const handler = handlers[key];
    if (handler !== undefined) return await handler(payload);

    await logger.logInternal(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      `Undefined command: ${commandName}`,
      { commandName, payload }
    );
    return { success: false, message: "Undefined command" };
  },
  list(): string[] {
    return [...COMMAND_LIST];
  },
};

export { serverCommands as ServerCommands };
