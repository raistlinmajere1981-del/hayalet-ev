import { whisperLoad, whisperSave } from "./whisper-manager.ts";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { LogCategory, LogLevel } from "../src/types/logging-core.js";

const logger = getLoggerCore();

// NOTE: WhisperManager here is the deferred message queue command, not the whisper.cpp speech runtime.
const COMMAND_LIST = ["WhisperManager", "AIAIChatStart", "AIAIChatStop"];

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
    await logger.logInternalT(
      LogCategory.SERVER_COMMANDS,
      LogLevel.INFO,
      "electron.serverCommands.logs.commandReceived",
      { name },
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
      message: 'Usage: ++cmd:WhisperManager(<accountId>, "<message>", "<time>")',
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

    await logger.logInternalT(
      LogCategory.SERVER_COMMANDS,
      LogLevel.INFO,
      "electron.serverCommands.logs.whisperAdded",
      { accountId },
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
    await logger.logInternalT(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      "electron.serverCommands.logs.whisperError",
      { message },
      { accountId, error: err }
    );
    return { success: false, message };
  }
};

const serverCommands = {
  init(_opts: ServerCommandsOptions = {}): void {},
  async run(
    _event: IpcMainInvokeEvent | null,
    commandName: string,
    payload: CommandPayload = {}
  ): Promise<unknown> {
    const key = commandName.toLowerCase();
    const handler = handlers[key];
    if (handler !== undefined) return await handler(payload);

    await logger.logInternalT(
      LogCategory.SERVER_COMMANDS,
      LogLevel.ERROR,
      "electron.serverCommands.logs.undefinedCommand",
      { commandName },
      { commandName, payload }
    );
    return { success: false, message: "Undefined command" };
  },
  list(): string[] {
    return [...COMMAND_LIST];
  },
};

export { serverCommands as ServerCommands };
