import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

function getConfigDir() {
  return join(process.cwd(), "config");
}

const configDir = getConfigDir();
const settingsPath = join(configDir, "settings.json");

/**
 * Default settings objesi
 */
function getDefaultSettings() {
  return {
    user: { nickname: "Kullanıcı", avatarPath: "" },
    integrations: {
      googledrive: {
        clientId: "",
        clientSecret: "",
        authorizationCode: "",
        connected: false,
        account: "",
      },
    },
    accounts: [],
    asistanAccounts: [
      {
        id: "opencode_opencode_at_opencode_com",
        email: "opencode@opencode.com",
        provider: "opencode",
        nickname: "OpenCode",
        avatarPath: "src/assets/opencode.png",
        isAsistan: true,
      },
    ],
    slots: {
      ai1: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      ai2: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
    },
    asistanSlot: {
      accountId: "opencode_opencode_at_opencode_com",
      catchCommands: false,
      messageMethod: "injection",
      fileMethod: "injection",
    },
    assistants: {
      preferred: "rovodev",
      preferredMode: "terminal",
      lastConnected: null,
    },
    logging: {
      level: "info",
      verboseModules: [],
      silentModules: [],
      persistLevel: "info",
      maxMemoryLogs: 200,
      enableStateSnapshots: true,
      snapshotInterval: 60000,
    },
  };
}

export async function loadSettings() {
  try {
    // Config klasörünü oluştur
    await mkdir(configDir, { recursive: true });

    if (existsSync(settingsPath)) {
      const data = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(data);
      return parsed;
    }
    
    // Dosya yoksa default settings ile oluştur
    const defaults = getDefaultSettings();
    const jsonString = JSON.stringify(defaults, null, 2);
    await writeFile(settingsPath, jsonString, { encoding: "utf-8", mode: 0o644 });
    console.log("[Main:SettingsManager] Created default settings.json");
    
    return defaults;
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

    const jsonString = JSON.stringify(settings, null, 2);
    await writeFile(settingsPath, jsonString, { encoding: "utf-8", mode: 0o644 });

    return true;
  } catch (error) {
    console.error("[Main:SettingsManager] Error saving settings:", error);
    return false;
  }
}
