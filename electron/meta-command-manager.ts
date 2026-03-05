/**
 * Meta Command Manager - Electron Main Process
 *
 * AI'ların dinamik olarak yeni komutlar tanımlamasını sağlar.
 * Komutlar config/custom-commands.json dosyasında kalıcı olarak saklanır.
 *
 * Güvenlik: Yok - Tam sistem erişimi ile JavaScript kodu çalıştırılabilir.
 */

import fs from "fs";
import path from "path";
import type { IpcMainInvokeEvent } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { Paths } from "./paths.ts";
import { LogCategory, LogLevel } from "@shared/index.js";

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
    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `loadCustomCommands error: ${(err as Error).message}`,
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
    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `saveCustomCommands error: ${(err as Error).message}`,
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

export function defineCommand(
  _event: IpcMainInvokeEvent,
  {
    name,
    description,
    code,
    createdBy,
  }: { name: string; description?: string; code: string; createdBy?: string }
): DefineCommandResult {
  try {
    if (typeof name !== "string" || name === "") {
      return { success: false, error: "Komut adı gerekli" };
    }

    if (typeof code !== "string" || code === "") {
      return { success: false, error: "Komut kodu gerekli" };
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

    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.INFO,
      `Command ${isUpdate ? "updated" : "created"}: ${normalizedName}`,
      { commandName: normalizedName, isUpdate, createdBy: createdBy ?? "unknown" }
    );

    return {
      success: true,
      message: `Komut ${isUpdate ? "güncellendi" : "oluşturuldu"}: ${normalizedName}`,
      command: commands[normalizedName],
    };
  } catch (err) {
    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `defineCommand error: ${(err as Error).message}`,
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

export function deleteCommand(
  _event: IpcMainInvokeEvent,
  { name }: { name: string }
): { success: boolean; message?: string; error?: string } {
  try {
    if (typeof name !== "string" || name === "") {
      return { success: false, error: "Komut adı gerekli" };
    }

    const commands = loadCustomCommands();

    const key = Object.keys(commands).find((k) => k.toLowerCase() === name.toLowerCase());

    if (key === undefined) {
      return { success: false, error: `Komut bulunamadı: ${name}` };
    }

    delete commands[key];
    saveCustomCommands(commands);

    void logger.logInternal(LogCategory.MAIN, LogLevel.INFO, `Komut silindi: ${key}`, {});

    return { success: true, message: `Komut silindi: ${key}` };
  } catch (err) {
    void logger.logInternal(LogCategory.MAIN, LogLevel.ERROR, "deleteCommand hatası", {
      error: err,
    });
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
    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `listCommands error: ${(err as Error).message}`,
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

export function getCommand(
  _event: IpcMainInvokeEvent,
  { name }: { name: string }
): { success: boolean; command?: CustomCommand; error?: string } {
  try {
    if (name === "") {
      return { success: false, error: "Komut adı gerekli" };
    }

    const commands = loadCustomCommands();

    const key = Object.keys(commands).find((k) => k.toLowerCase() === name.toLowerCase());

    if (key === undefined) {
      return { success: false, error: `Komut bulunamadı: ${name}` };
    }

    const command = commands[key];
    return command !== undefined
      ? { success: true, command }
      : { success: false, error: `Komut bulunamadı: ${name}` };
  } catch (err) {
    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `getCommand error: ${(err as Error).message}`,
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
