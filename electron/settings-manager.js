import { join } from "path";
import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";

// Settings now stored in project directory for portability
// Path: ./config/settings.json (relative to project root)
function getConfigDir() {
  return join(process.cwd(), "config");
}

const configDir = getConfigDir();
const settingsPath = join(configDir, "settings.json");

// Main process persistence: read/write only (no schema/migration logic)
// Schema normalization is handled in renderer (settings-schema.js)

export async function loadSettings() {
  try {
    if (existsSync(settingsPath)) {
      const data = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(data);
      return parsed;
    }
    
    // Return minimal stub if file doesn't exist; renderer will normalize
    const stub = {
      user: { nickname: "Kullanıcı", avatarPath: "" },
      integrations: { googledrive: {} },
      accounts: [],
      slots: { ai1: {}, ai2: {} },
    };
    return stub;
  } catch (error) {
    console.error("[Main:SettingsManager] Error loading settings:", error);
    return null;
  }
}

export async function saveSettings(eventOrSettings, maybeSettings) {
  try {
    const settings =
      typeof maybeSettings === "undefined" ? eventOrSettings : maybeSettings;

    // Ensure config directory exists
    await mkdir(configDir, { recursive: true });

    // Backup existing settings BEFORE writing
    const backupPath = `${settingsPath}.bak`;
    if (existsSync(settingsPath)) {
      try {
        await copyFile(settingsPath, backupPath);
      } catch (err) {
        console.warn("[Main:SettingsManager] Backup failed (non-critical):", err);
      }
    }

    // Simple direct write - no atomic rename complexity
    const jsonString = JSON.stringify(settings, null, 2);
    await writeFile(settingsPath, jsonString, { encoding: "utf-8", mode: 0o644 });

    return true;
  } catch (error) {
    console.error("[Main:SettingsManager] Error saving settings:", error);
    return false;
  }
}
