/**
 * ServerCommands - Komut Dispatcher (Orchestrator)
 * 
 * Alt modüller:
 * - commands/utils.js: Ortak yardımcı fonksiyonlar
 * - commands/device-commands.js: DeviceManager handler
 * - commands/screenshot-commands.js: Screenshot handler'ları
 * - commands/window-commands.js: Window handler'ları
 * - commands/whisper-commands.js: Whisper handler
 * - commands/file-commands.js: File handler'ları
 * - commands/ai-chat-commands.js: AI-AI chat handler'ları
 */

import { LogManager } from "./log-manager.js";
import { createDefaultHandler } from "./commands/utils.js";
import type { CommandPayload } from "../types/commands.js";

import { deviceManagerHandler } from "./commands/device-commands.js";
import { screenshotManagerHandler, takeScreenshotHandler } from "./commands/screenshot-commands.js";
import { 
  windowManagerHandler, 
  minimizeHandler, 
  maximizeHandler, 
  restoreHandler,
  restartHandler 
} from "./commands/window-commands.js";
import { whisperManagerHandler } from "./commands/whisper-commands.js";
import { listFilesHandler } from "./commands/file-commands.js";
import { aiaiChatStartHandler, aiaiChatStopHandler, aiAsistanChatStartHandler, aiAsistanChatStopHandler } from "./commands/ai-chat-commands.js";
import { MetaCommandManager } from "./meta-command-manager.js";

// ============================================
// ============================================

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
  "AIAsistanChatStart",
  "AIAsistanChatStop",
  "GetFile",
  "GetItDone",
  "ListFiles",
  // Meta komutlar
  "DefineCommand",
  "DeleteCommand",
  "ListCustomCommands",
];

// ============================================
// ============================================
const handlers: Record<string, (payload?: CommandPayload) => Promise<unknown>> = {};

COMMAND_LIST.forEach((name) => {
  const key = name.toLowerCase();
  if (!["whispermanager", "devicemanager", "screenshotmanager", "takescreenshot", 
       "windowmanager", "minimize", "maximize", "restore", "restart",
       "listfiles", "aiaichatstart", "aiaichatstop", "aiasistanchatstart", "aiasistanchatstop"].includes(key)) {
    handlers[key] = createDefaultHandler(name);
  }
});

handlers.devicemanager = deviceManagerHandler;
handlers.screenshotmanager = screenshotManagerHandler;
handlers.takescreenshot = takeScreenshotHandler;
handlers.windowmanager = windowManagerHandler;
handlers.minimize = minimizeHandler;
handlers.maximize = maximizeHandler;
handlers.restore = restoreHandler;
handlers.restart = restartHandler;
handlers.whispermanager = whisperManagerHandler;
handlers.listfiles = listFilesHandler;
handlers.aiaichatstart = aiaiChatStartHandler;
handlers.aiaichatstop = aiaiChatStopHandler;
handlers.aiasistanchatstart = aiAsistanChatStartHandler;
handlers.aiasistanchatstop = aiAsistanChatStopHandler;

// Meta komut handler'ları
handlers.definecommand = async (payload?: CommandPayload) => {
  const args = (payload?.args as string) || "";
  // Format: DefineCommand(Name, "description", `code`)
  // Parse: İlk virgüle kadar isim, sonra açıklama, sonra kod
  const match = args.match(/^([A-Za-z0-9_]+)\s*,\s*"([^"]*)"\s*,\s*`([\s\S]*)`$/);
  
  if (!match) {
    return { success: false, error: "Geçersiz format. Kullanım: DefineCommand(Name, \"açıklama\", `kod`)" };
  }
  
  const [, name, description, code] = match;
  if (!name || !description || !code) {
    return { success: false, error: "Geçersiz komut bilgileri" };
  }
  const sender = payload?.sender ? String(payload.sender) : "unknown";
  const result = await MetaCommandManager.defineCommand(name, description, code, sender);
  return result;
};

handlers.deletecommand = async (payload?: CommandPayload) => {
  const name = ((payload?.args as string) || "").trim();
  if (!name) {
    return { success: false, error: "Komut adı gerekli" };
  }
  const result = await MetaCommandManager.deleteCommand(name);
  return result;
};

handlers.listcustomcommands = async () => {
  const commands = MetaCommandManager.listCommands();
  const names = Object.keys(commands);
  return { 
    success: true, 
    message: names.length ? `Custom komutlar: ${names.join(", ")}` : "Henüz custom komut tanımlanmamış",
    commands 
  };
};

// ============================================
// ============================================

export const ServerCommands = {
  /**
   * Komutu çalıştır
   * @param {string} commandName - Komut adı
   * @param {Object} payload - Komut payload'ı
   * @returns {Promise<Object>}
   */
  async run(commandName: string, payload: Record<string, unknown> = {}) {
    const key = (commandName || "").toLowerCase();
    const handler = handlers[key];
    
    // Önce sistem handler'larına bak
    if (handler) {
      return handler(payload);
    }
    
    // Sonra custom komutlara bak
    if (MetaCommandManager.hasCommand(commandName)) {
      const argsStr = (payload as any)?.args || "";
      // Argümanları parse et (virgülle ayrılmış)
      const args = argsStr ? argsStr.split(",").map((s: string) => s.trim().replace(/^["']|["']$/g, "")) : [];
      return MetaCommandManager.runCommand(commandName, args);
    }
    
    LogManager.addEvent(
      "server-command",
      "warning",
      `Tanımsız komut: ${commandName}`,
    );
    return { success: false, message: "Tanımsız komut" };
  },

  /**
   * Komut listesini getir (sistem + custom)
   * @returns {string[]}
   */
  list() {
    const customCmds = MetaCommandManager.getCommandNames();
    return [...COMMAND_LIST, ...customCmds];
  },

  /**
   * Handler kaydetli mi kontrol et (sistem + custom)
   * @param {string} commandName - Komut adı
   * @returns {boolean}
   */
  has(commandName: string) {
    const key = (commandName || "").toLowerCase();
    return !!handlers[key] || MetaCommandManager.hasCommand(commandName);
  },

  /**
   * Özel handler kaydet
   * @param {string} commandName - Komut adı
   * @param {Function} handler - Handler fonksiyonu
   */
  register(commandName: string, handler: (payload?: unknown) => Promise<unknown>) {
    if (typeof handler === "function") {
      handlers[commandName.toLowerCase()] = handler;
    }
  },
};
