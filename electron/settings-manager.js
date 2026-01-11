import { join } from "path";
import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";

function getConfigDir() {
  return join(process.cwd(), "config");
}

const configDir = getConfigDir();
const settingsPath = join(configDir, "settings.json");


export async function loadSettings() {
  try {
    if (existsSync(settingsPath)) {
      const data = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(data);
      return parsed;
    }
    
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

    await mkdir(configDir, { recursive: true });

    const backupPath = `${settingsPath}.bak`;
    if (existsSync(settingsPath)) {
      try {
        await copyFile(settingsPath, backupPath);
      } catch (err) {
        console.warn("[Main:SettingsManager] Backup failed (non-critical):", err);
      }
    }

    const jsonString = JSON.stringify(settings, null, 2);
    await writeFile(settingsPath, jsonString, { encoding: "utf-8", mode: 0o644 });

    return true;
  } catch (error) {
    console.error("[Main:SettingsManager] Error saving settings:", error);
    return false;
  }
}
