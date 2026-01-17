/**
 * Meta Command Manager - Renderer Process
 * 
 * AI'ların dinamik olarak yeni komutlar tanımlamasını sağlar.
 * Komutlar JavaScript kodu olarak saklanır ve çalıştırılır.
 * 
 * Komut Formatı:
 * ++meta:DefineCommand(KomutAdi, "açıklama", `
 *   async function(args, context) {
 *     // context: { LogManager, AppState, TrafficManager, ... }
 *     return { success: true, result: "..." };
 *   }
 * `)
 * 
 * ++meta:DeleteCommand(KomutAdi)
 * ++meta:ListCommands()
 */

import { LogManager } from "./log-manager.js";
import { AppState } from "./app-state.js";
import { TrafficManager } from "./traffic-manager.js";
import { SlotController } from "./slot-controller.js";
import { WebviewManager } from "./webview-manager.js";
import { RelayManager } from "./relay-manager.js";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// State
// ============================================================================

// Runtime'da yüklenen custom komutlar
let _customCommands: Record<string, CustomCommand> = {};
let _compiledHandlers: Record<string, CompiledHandler> = {};

// ============================================================================
// Functions
// ============================================================================

/**
 * Context objesi - custom komutlara geçirilir
 */
function createContext(): Record<string, unknown> {
  return {
    LogManager,
    AppState,
    TrafficManager,
    SlotController,
    WebviewManager,
    RelayManager,
    // Utility fonksiyonlar
    delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (msg: string) => LogManager.addEvent("custom-cmd", "info", msg),
    error: (msg: string) => LogManager.addEvent("custom-cmd", "error", msg),
  };
}

/**
 * Komut kodunu derle ve handler oluştur
 */
function compileCommand(name: string, code: string): CompiledHandler | null {
  try {
    // Kodu Function constructor ile derle (güvenlik kısıtlaması yok - tam yetki)
    const fn = new Function("args", "context", `
      return (async function() {
        ${code}
      })();
    `);

    LogManager.addEvent("meta-command", "info", `Komut derlendi: ${name}`);
    return fn as CompiledHandler;
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `Komut derleme hatası (${name}): ${(err as Error).message}`);
    return null;
  }
}

/**
 * Custom komutları electron'dan yükle
 */
async function loadCommands(): Promise<void> {
  try {
    const result = await window.electronAPI?.metaListCommands?.() as CommandResult | undefined;
    if (result?.success && result.commands) {
      _customCommands = result.commands;

      // Tüm komutları derle
      _compiledHandlers = {};
      for (const [name, cmd] of Object.entries(_customCommands)) {
        const handler = compileCommand(name, cmd.code);
        if (handler) {
          _compiledHandlers[name.toLowerCase()] = handler;
        }
      }

      LogManager.addEvent("meta-command", "info", `${Object.keys(_customCommands).length} custom komut yüklendi`);
    }
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `loadCommands hatası: ${(err as Error).message}`);
  }
}

/**
 * Yeni komut tanımla
 */
async function defineCommand(
  name: string,
  description: string,
  code: string,
  createdBy = "unknown"
): Promise<CommandResult> {
  try {
    // Önce kodu test et (derleme hatası var mı?)
    const testHandler = compileCommand(name, code);
    if (!testHandler) {
      return { success: false, error: "Kod derleme hatası" };
    }

    // Electron'a kaydet
    const result = await window.electronAPI?.metaDefineCommand?.({
      name,
      description,
      code,
      createdBy,
    });

    if (result?.success && result.command) {
      // Runtime cache'i güncelle
      _customCommands[name] = result.command;
      _compiledHandlers[name.toLowerCase()] = testHandler;

      LogManager.addEvent("meta-command", "info", `Komut tanımlandı: ${name}`);
    }

    return (result as CommandResult) || { success: false, error: "API hatası" };
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `defineCommand hatası: ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Komutu sil
 */
async function deleteCommand(name: string): Promise<CommandResult> {
  try {
    const result = await window.electronAPI?.metaDeleteCommand?.({ name });

    if (result?.success) {
      // Runtime cache'den kaldır
      const key = Object.keys(_customCommands).find(
        (k) => k.toLowerCase() === name.toLowerCase()
      );
      if (key) {
        delete _customCommands[key];
        delete _compiledHandlers[key.toLowerCase()];
      }

      LogManager.addEvent("meta-command", "info", `Komut silindi: ${name}`);
    }

    return (result as CommandResult) || { success: false, error: "API hatası" };
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `deleteCommand hatası: ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Tüm custom komutları listele
 */
function listCommands(): Record<string, CustomCommand> {
  return { ..._customCommands };
}

/**
 * Custom komut var mı kontrol et
 */
function hasCommand(name: string): boolean {
  return !!_compiledHandlers[name.toLowerCase()];
}

/**
 * Custom komutu çalıştır
 */
async function runCommand(name: string, args: unknown[] = []): Promise<CommandResult> {
  const handler = _compiledHandlers[name.toLowerCase()];

  if (!handler) {
    return { success: false, error: `Custom komut bulunamadı: ${name}` };
  }

  try {
    LogManager.addEvent("meta-command", "info", `Çalıştırılıyor: ${name}(${args.join(", ")})`);

    const context = createContext();
    const result = await handler(args, context);

    LogManager.addEvent("meta-command", "info", `Tamamlandı: ${name}`);

    return { success: true, result };
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `Çalıştırma hatası (${name}): ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Custom komut isimlerini döndür (ServerCommands için)
 */
function getCommandNames(): string[] {
  return Object.keys(_customCommands);
}

/**
 * MetaCommandManager export
 */
export const MetaCommandManager = {
  loadCommands,
  defineCommand,
  deleteCommand,
  listCommands,
  hasCommand,
  runCommand,
  getCommandNames,
};
