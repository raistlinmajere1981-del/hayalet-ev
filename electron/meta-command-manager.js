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
import { app } from "electron";

const CONFIG_DIR = path.join(app.getAppPath(), "config");
const COMMANDS_FILE = path.join(CONFIG_DIR, "custom-commands.json");

/**
 * Config klasörünü oluştur (yoksa)
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Tüm custom komutları yükle
 * @returns {Object} - { commandName: { name, description, code, createdAt, createdBy } }
 */
export function loadCustomCommands() {
  try {
    ensureConfigDir();
    if (!fs.existsSync(COMMANDS_FILE)) {
      return {};
    }
    const content = fs.readFileSync(COMMANDS_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("[MetaCommand] loadCustomCommands hatası:", err);
    return {};
  }
}

/**
 * Custom komutları kaydet
 * @param {Object} commands - Komut objesi
 */
function saveCustomCommands(commands) {
  try {
    ensureConfigDir();
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2), "utf-8");
  } catch (err) {
    console.error("[MetaCommand] saveCustomCommands hatası:", err);
    throw err;
  }
}

/**
 * Yeni custom komut tanımla
 * @param {Object} event - IPC event
 * @param {Object} params - { name, description, code, createdBy }
 * @returns {{ success: boolean, message?: string, error?: string, command?: Object }}
 */
export function defineCommand(event, { name, description, code, createdBy }) {
  try {
    if (!name || typeof name !== "string") {
      return { success: false, error: "Komut adı gerekli" };
    }

    if (!code || typeof code !== "string") {
      return { success: false, error: "Komut kodu gerekli" };
    }

    // Komut adını normalize et (PascalCase)
    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1);

    const commands = loadCustomCommands();

    // Komut zaten var mı kontrol et
    const isUpdate = !!commands[normalizedName];

    commands[normalizedName] = {
      name: normalizedName,
      description: description || "",
      code: code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: createdBy || "unknown",
    };

    saveCustomCommands(commands);

    console.log(`[MetaCommand] Komut ${isUpdate ? "güncellendi" : "oluşturuldu"}: ${normalizedName}`);

    return { 
      success: true, 
      message: `Komut ${isUpdate ? "güncellendi" : "oluşturuldu"}: ${normalizedName}`,
      command: commands[normalizedName]
    };
  } catch (err) {
    console.error("[MetaCommand] defineCommand hatası:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Custom komutu sil
 * @param {Object} event - IPC event
 * @param {Object} params - { name }
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
export function deleteCommand(event, { name }) {
  try {
    if (!name || typeof name !== "string") {
      return { success: false, error: "Komut adı gerekli" };
    }

    const commands = loadCustomCommands();

    // Case-insensitive arama
    const key = Object.keys(commands).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );

    if (!key) {
      return { success: false, error: `Komut bulunamadı: ${name}` };
    }

    delete commands[key];
    saveCustomCommands(commands);

    console.log(`[MetaCommand] Komut silindi: ${key}`);

    return { success: true, message: `Komut silindi: ${key}` };
  } catch (err) {
    console.error("[MetaCommand] deleteCommand hatası:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Tüm custom komutları listele
 * @param {Object} event - IPC event
 * @returns {{ success: boolean, commands: Object, error?: string }}
 */
export function listCommands(event) {
  try {
    const commands = loadCustomCommands();
    return { success: true, commands };
  } catch (err) {
    console.error("[MetaCommand] listCommands hatası:", err);
    return { success: false, commands: {}, error: err.message };
  }
}

/**
 * Tek bir custom komutu getir
 * @param {Object} event - IPC event
 * @param {Object} params - { name }
 * @returns {{ success: boolean, command?: Object, error?: string }}
 */
export function getCommand(event, { name }) {
  try {
    if (!name) {
      return { success: false, error: "Komut adı gerekli" };
    }

    const commands = loadCustomCommands();

    // Case-insensitive arama
    const key = Object.keys(commands).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );

    if (!key) {
      return { success: false, error: `Komut bulunamadı: ${name}` };
    }

    return { success: true, command: commands[key] };
  } catch (err) {
    console.error("[MetaCommand] getCommand hatası:", err);
    return { success: false, error: err.message };
  }
}

/**
 * MetaCommandManager export
 */
export const MetaCommandManager = {
  loadCustomCommands,
  defineCommand,
  deleteCommand,
  listCommands,
  getCommand,
};
