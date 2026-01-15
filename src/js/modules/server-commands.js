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
];

// ============================================
// ============================================

const handlers = {};

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

// ============================================
// ============================================

export const ServerCommands = {
  /**
   * Komutu çalıştır
   * @param {string} commandName - Komut adı
   * @param {Object} payload - Komut payload'ı
   * @returns {Promise<Object>}
   */
  async run(commandName, payload = {}) {
    const key = (commandName || "").toLowerCase();
    const handler = handlers[key];
    
    if (handler) {
      return handler(payload);
    }
    
    LogManager.addEvent(
      "server-command",
      "warning",
      `Tanımsız komut: ${commandName}`,
    );
    return { success: false, message: "Tanımsız komut" };
  },

  /**
   * Komut listesini getir
   * @returns {string[]}
   */
  list() {
    return [...COMMAND_LIST];
  },

  /**
   * Handler kaydetli mi kontrol et
   * @param {string} commandName - Komut adı
   * @returns {boolean}
   */
  has(commandName) {
    const key = (commandName || "").toLowerCase();
    return !!handlers[key];
  },

  /**
   * Özel handler kaydet
   * @param {string} commandName - Komut adı
   * @param {Function} handler - Handler fonksiyonu
   */
  register(commandName, handler) {
    if (typeof handler === "function") {
      handlers[commandName.toLowerCase()] = handler;
    }
  },
};
