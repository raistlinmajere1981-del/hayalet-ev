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

// Runtime'da yüklenen custom komutlar
let _customCommands = {};
let _compiledHandlers = {};

/**
 * Context objesi - custom komutlara geçirilir
 */
function createContext() {
  return {
    LogManager,
    AppState,
    TrafficManager,
    SlotController,
    WebviewManager,
    RelayManager,
    // Utility fonksiyonlar
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (msg) => LogManager.addEvent("custom-cmd", "info", msg),
    error: (msg) => LogManager.addEvent("custom-cmd", "error", msg),
  };
}

/**
 * Komut kodunu derle ve handler oluştur
 * @param {string} name - Komut adı
 * @param {string} code - JavaScript kodu
 * @returns {Function|null} - Derlenmiş handler veya null
 */
function compileCommand(name, code) {
  try {
    // Kodu Function constructor ile derle (güvenlik kısıtlaması yok - tam yetki)
    const fn = new Function("args", "context", `
      return (async function() {
        ${code}
      })();
    `);

    LogManager.addEvent("meta-command", "info", `Komut derlendi: ${name}`);
    return fn;
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `Komut derleme hatası (${name}): ${(err as Error).message}`);
    return null;
  }
}

/**
 * Custom komutları electron'dan yükle
 */
async function loadCommands() {
  try {
    const result = await window.electronAPI?.metaListCommands?.();
    if (result?.success && result.commands) {
      _customCommands = result.commands;

      // Tüm komutları derle
      _compiledHandlers = {};
      for (const [name, cmd] of Object.entries(_customCommands)) {
        const handler = compileCommand(name, (cmd as any).code);
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
 * @param {string} name - Komut adı
 * @param {string} description - Açıklama
 * @param {string} code - JavaScript kodu
 * @param {string} createdBy - Oluşturan (ai1, ai2, user)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function defineCommand(name, description, code, createdBy = "unknown") {
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

    if (result?.success) {
      // Runtime cache'i güncelle
      _customCommands[name] = result.command;
      _compiledHandlers[name.toLowerCase()] = testHandler;

      LogManager.addEvent("meta-command", "info", `Komut tanımlandı: ${name}`);
    }

    return result || { success: false, error: "API hatası" };
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `defineCommand hatası: ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Komutu sil
 * @param {string} name - Komut adı
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function deleteCommand(name) {
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

    return result || { success: false, error: "API hatası" };
  } catch (err) {
    LogManager.addEvent("meta-command", "error", `deleteCommand hatası: ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Tüm custom komutları listele
 * @returns {Object} - { name: { description, code, createdAt, createdBy } }
 */
function listCommands() {
  return { ..._customCommands };
}

/**
 * Custom komut var mı kontrol et
 * @param {string} name - Komut adı
 * @returns {boolean}
 */
function hasCommand(name) {
  return !!_compiledHandlers[name.toLowerCase()];
}

/**
 * Custom komutu çalıştır
 * @param {string} name - Komut adı
 * @param {Array} args - Argümanlar
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
async function runCommand(name, args = []) {
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
 * @returns {string[]}
 */
function getCommandNames() {
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
