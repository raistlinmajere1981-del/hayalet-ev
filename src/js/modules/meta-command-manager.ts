import { LogCategory } from "@shared/logging-core";
/**
 * Meta Command Manager - Renderer Process
 *
 * AI'ların dinamik olarak yeni komutlar tanımlamasını sağlar.
 * Komutlar JavaScript kodu olarak saklanır ve çalıştırılır.
 *
 * Komut Formatı:
 * ++meta:DefineCommand(KomutAdi, "açıklama", `
 *   async function(args, context) {
 *     // context: { Logger, AppState, TrafficManager, ... }
 *     // Logger kullanımı:
 *     context.Logger.info(context.LogCategory.SYSTEM, "Komut çalıştırıldı");
 *     return { success: true, result: "..." };
 *   }
 * `)
 *
 * ++meta:DeleteCommand(KomutAdi)
 * ++meta:ListCommands()
 *
 * NOTE: Unified Logger sistemi kullanılıyor.
 * Context'te Logger ve LogCategory enum'ları mevcut.
 */

import { Logger } from "./logger/index.js";
import { AppState } from "./app-state.js";
import { TrafficManager } from "./traffic-manager.js";
import { SlotController } from "./slot-controller.js";
import { WebviewManager } from "./webview-manager.js";
import { RelayManager } from "./relay-manager.js";

interface CustomCommand {
  name: string;
  description: string;
  code: string;
  createdAt?: number;
  createdBy?: string;
}

interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
  command?: CustomCommand;
  commands?: Record<string, CustomCommand>;
}

type CompiledHandler = (args: unknown[], context: Record<string, unknown>) => Promise<unknown>;

let _customCommands: Record<string, CustomCommand> = {};
let _compiledHandlers: Record<string, CompiledHandler> = {};

/**
 * Context objesi - custom komutlara geçirilir
 *
 * Available in context:
 * - Logger: Unified logging system
 * - LogCategory: Log category enum
 * - LogVisibility: Visibility level enum
 * - AppState, TrafficManager, SlotController, WebviewManager, RelayManager
 */
function createContext(): Record<string, unknown> {
  return {
    Logger,
    AppState,
    TrafficManager,
    SlotController,
    WebviewManager,
    RelayManager,
    delay: async (ms: number): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
    log: (msg: string): void => {
      Logger.info(LogCategory.META_COMMAND, msg);
    },
    error: (msg: string): void => {
      Logger.error(LogCategory.META_COMMAND, msg);
    },
  };
}

function compileCommand(name: string, code: string): CompiledHandler | null {
  try {
    const fn = new Function(
      "args",
      "context",
      `
      return (async function() {
        ${code}
      })();
    `
    );

    return fn as CompiledHandler;
  } catch (err) {
    Logger.error(
      LogCategory.META_COMMAND,
      `Komut derleme hatası (${name}): ${(err as Error).message}`
    );
    return null;
  }
}

async function loadCommands(): Promise<void> {
  try {
    const result = (await window.electronAPI?.["metaListCommands"]?.()) as
      | CommandResult
      | undefined;
    if (result?.success === true && result.commands !== undefined) {
      _customCommands = result.commands;

      _compiledHandlers = {};
      for (const [name, cmd] of Object.entries(_customCommands)) {
        const handler = compileCommand(name, cmd.code);
        if (handler !== null) {
          _compiledHandlers[name.toLowerCase()] = handler;
        }
      }

      Logger.info(
        LogCategory.META_COMMAND,
        `${Object.keys(_customCommands).length} custom komut yüklendi`
      );
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    Logger.error(LogCategory.META_COMMAND, `loadCommands hatası: ${error.message}`);
  }
}

async function defineCommand(
  name: string,
  description: string,
  code: string,
  createdBy = "unknown"
): Promise<CommandResult> {
  try {
    const testHandler = compileCommand(name, code);
    if (testHandler === null) {
      return { success: false, error: "Kod derleme hatası" };
    }

    const result = (await window.electronAPI?.["metaDefineCommand"]?.({
      name,
      description,
      code,
      createdBy,
    })) as { success?: boolean; command?: string; error?: string } | undefined;

    let parsedCommand: CustomCommand | undefined;

    if (result?.success === true && result.command !== undefined && result.command !== "") {
      try {
        parsedCommand = JSON.parse(result.command) as CustomCommand;
        _customCommands[name] = parsedCommand;
        _compiledHandlers[name.toLowerCase()] = testHandler;

        Logger.info(LogCategory.META_COMMAND, `Komut tanımlandı: ${name}`);
      } catch {
        return { success: false, error: "Komut ayrıştırma hatası" };
      }
    }

    if (result === undefined) {
      return { success: false, error: "API hatası" };
    }

    return {
      success: Boolean(result.success),
      ...(result.error !== undefined ? { error: result.error } : {}),
      ...(parsedCommand !== undefined ? { command: parsedCommand } : {}),
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    Logger.error(LogCategory.META_COMMAND, `defineCommand hatası: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function deleteCommand(name: string): Promise<CommandResult> {
  try {
    const result = (await window.electronAPI?.["metaDeleteCommand"]?.({ name })) as
      | { success?: boolean; error?: string }
      | undefined;

    if (result?.success === true) {
      const key = Object.keys(_customCommands).find((k) => k.toLowerCase() === name.toLowerCase());
      if (key !== undefined) {
        delete _customCommands[key];
        delete _compiledHandlers[key.toLowerCase()];
      }
    }

    return result as CommandResult;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    Logger.error(LogCategory.META_COMMAND, `deleteCommand hatası: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function listCommands(): Record<string, CustomCommand> {
  return { ..._customCommands };
}

function hasCommand(name: string): boolean {
  return _compiledHandlers[name.toLowerCase()] !== undefined;
}

async function runCommand(name: string, args: unknown[] = []): Promise<CommandResult> {
  const handler = _compiledHandlers[name.toLowerCase()];

  if (handler === undefined) {
    return { success: false, error: `Custom komut bulunamadı: ${name}` };
  }

  try {
    const context = createContext();
    const result = await handler(args, context);

    return { success: true, result };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    Logger.error(LogCategory.META_COMMAND, `Çalıştırma hatası (${name}): ${error.message}`);
    return { success: false, error: error.message };
  }
}

function getCommandNames(): string[] {
  return Object.keys(_customCommands);
}

const metaCommandManager = {
  loadCommands,
  defineCommand,
  deleteCommand,
  listCommands,
  hasCommand,
  runCommand,
  getCommandNames,
};

export { metaCommandManager as MetaCommandManager };
