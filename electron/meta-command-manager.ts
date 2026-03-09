/**
 * Meta Command Manager - Electron Main Process
 *
 * Allows AIs to define new commands dynamically.
 * Commands are stored persistently in config/custom-commands.json.
 *
 * Security: none - JavaScript code can run with full system access.
 */

import fs from "fs";
import path from "path";
import type { IpcMainInvokeEvent } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { Paths } from "./paths.ts";
import { loadSettings } from "./settings-manager.ts";
import { LogCategory, LogLevel } from "@shared/index.js";
import type { TranslationParams } from "../src/types/i18n.ts";
import { DEFAULT_APP_LANGUAGE } from "../src/types/i18n.ts";
import { loadAvailableLanguage } from "./i18n/language-service.ts";
import { translateCatalog } from "../shared/i18n/catalog.js";
import { getBuiltInLanguagePack } from "../shared/i18n/bundled-languages.js";
import { normalizeAppLanguage } from "../shared/i18n/locale.js";

const logger = getLoggerCore();

interface CustomCommand {
  name: string;
  description: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

type CommandsMap = Record<string, CustomCommand>;

async function translateElectronMessage(key: string, params?: TranslationParams): Promise<string> {
  let settings: { general?: { language?: unknown } } = {};
  try {
    settings = ((await loadSettings()) ?? {}) as { general?: { language?: unknown } };
  } catch {
    settings = {};
  }

  const locale = normalizeAppLanguage(settings.general?.language);
  const activePack =
    (await loadAvailableLanguage(locale)) ?? getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)!;
  const fallbackCatalog = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;

  return translateCatalog(activePack.catalog, key, params, fallbackCatalog);
}

async function metaCommandT(key: string, params?: TranslationParams): Promise<string> {
  return await translateElectronMessage(`electron.metaCommand.${key}`, params);
}

function parseCommandsMap(content: string): CommandsMap {
  const parsed: unknown = JSON.parse(content);
  return typeof parsed === "object" && parsed !== null ? (parsed as CommandsMap) : {};
}

function getCommandsFile(): string {
  return path.join(Paths.getConfigDir(), "custom-commands.json");
}

function ensureConfigDir(): void {
  const configDir = Paths.getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

export function loadCustomCommands(): CommandsMap {
  try {
    ensureConfigDir();
    if (!fs.existsSync(getCommandsFile())) {
      return {};
    }
    const content = fs.readFileSync(getCommandsFile(), "utf-8");
    return parseCommandsMap(content);
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.metaCommand.logs.loadCustomCommandsError",
      { message: (err as Error).message },
      {
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
    return {};
  }
}

function saveCustomCommands(commands: CommandsMap): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(getCommandsFile(), JSON.stringify(commands, null, 2), "utf-8");
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.metaCommand.logs.saveCustomCommandsError",
      { message: (err as Error).message },
      {
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
    throw err;
  }
}

interface DefineCommandResult {
  success: boolean;
  message?: string;
  error?: string;
  command?: CustomCommand;
}

export async function defineCommand(
  _event: IpcMainInvokeEvent,
  {
    name,
    description,
    code,
    createdBy,
  }: { name: string; description?: string; code: string; createdBy?: string }
): Promise<DefineCommandResult> {
  try {
    if (typeof name !== "string" || name === "") {
      return { success: false, error: await metaCommandT("commandNameRequired") };
    }

    if (typeof code !== "string" || code === "") {
      return { success: false, error: await metaCommandT("commandCodeRequired") };
    }

    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1);

    const commands = loadCustomCommands();

    const isUpdate = commands[normalizedName] !== undefined;

    commands[normalizedName] = {
      name: normalizedName,
      description: description ?? "",
      code: code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: createdBy ?? "unknown",
    };

    saveCustomCommands(commands);

    const logMessage = await metaCommandT(isUpdate ? "commandUpdated" : "commandCreated", {
      name: normalizedName,
    });

    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      isUpdate ? "electron.metaCommand.commandUpdated" : "electron.metaCommand.commandCreated",
      { name: normalizedName },
      { commandName: normalizedName, isUpdate, createdBy: createdBy ?? "unknown" }
    );

    return {
      success: true,
      message: logMessage,
      command: commands[normalizedName],
    };
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.metaCommand.logs.defineCommandError",
      { message: (err as Error).message },
      {
        commandName: name,
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteCommand(
  _event: IpcMainInvokeEvent,
  { name }: { name: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (typeof name !== "string" || name === "") {
      return { success: false, error: await metaCommandT("commandNameRequired") };
    }

    const commands = loadCustomCommands();

    const key = Object.keys(commands).find((k) => k.toLowerCase() === name.toLowerCase());

    if (key === undefined) {
      return { success: false, error: await metaCommandT("commandNotFound", { name }) };
    }

    delete commands[key];
    saveCustomCommands(commands);

    const successMessage = await metaCommandT("commandDeleted", { name: key });
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      "electron.metaCommand.commandDeleted",
      { name: key },
      { commandName: key }
    );

    return { success: true, message: successMessage };
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.metaCommand.logs.deleteCommandError",
      { message: (err as Error).message },
      {
        error: err,
      }
    );
    return { success: false, error: (err as Error).message };
  }
}

export function listCommands(_event: IpcMainInvokeEvent): {
  success: boolean;
  commands: CommandsMap;
  error?: string;
} {
  try {
    const commands = loadCustomCommands();
    return { success: true, commands };
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.metaCommand.logs.listCommandsError",
      { message: (err as Error).message },
      {
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
    return { success: false, commands: {}, error: (err as Error).message };
  }
}

export async function getCommand(
  _event: IpcMainInvokeEvent,
  { name }: { name: string }
): Promise<{ success: boolean; command?: CustomCommand; error?: string }> {
  try {
    if (name === "") {
      return { success: false, error: await metaCommandT("commandNameRequired") };
    }

    const commands = loadCustomCommands();

    const key = Object.keys(commands).find((k) => k.toLowerCase() === name.toLowerCase());

    if (key === undefined) {
      return { success: false, error: await metaCommandT("commandNotFound", { name }) };
    }

    const command = commands[key];
    return command !== undefined
      ? { success: true, command }
      : { success: false, error: await metaCommandT("commandNotFound", { name }) };
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.metaCommand.logs.getCommandError",
      { message: (err as Error).message },
      {
        commandName: name,
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
    return { success: false, error: (err as Error).message };
  }
}

const metaCommandManager = {
  loadCustomCommands,
  defineCommand,
  deleteCommand,
  listCommands,
  getCommand,
};

export { metaCommandManager as MetaCommandManager };
