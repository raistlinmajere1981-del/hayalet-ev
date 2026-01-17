import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import type { IpcMainInvokeEvent } from "electron";

function getConfigDir(): string {
  return join(process.cwd(), "config");
}

const configDir = getConfigDir();
const settingsPath = join(configDir, "settings.json");

interface DefaultSettings {
  user: { nickname: string; avatarPath: string };
  integrations: {
    googledrive: {
      clientId: string;
      clientSecret: string;
      authorizationCode: string;
      connected: boolean;
      account: string;
    };
  };
  accounts: unknown[];
  asistanAccounts: Array<{
    id: string;
    email: string;
    provider: string;
    nickname: string;
    avatarPath: string;
    isAsistan: boolean;
  }>;
  slots: {
    ai1: {
      accountId: string | null;
      catchCommands: boolean;
      messageMethod: string;
      fileMethod: string;
    };
    ai2: {
      accountId: string | null;
      catchCommands: boolean;
      messageMethod: string;
      fileMethod: string;
    };
  };
  asistanSlot: {
    accountId: string;
    catchCommands: boolean;
    messageMethod: string;
    fileMethod: string;
  };
  assistants: {
    preferred: string;
    preferredMode: string;
    lastConnected: string | null;
  };
  logging: {
    level: string;
    verboseModules: string[];
    silentModules: string[];
    persistLevel: string;
    maxMemoryLogs: number;
    enableStateSnapshots: boolean;
    snapshotInterval: number;
  };
}

/**
 * Default settings objesi
 */
function getDefaultSettings(): DefaultSettings {
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

export async function loadSettings(): Promise<DefaultSettings | null> {
  try {
    // Config klasörünü oluştur
    await mkdir(configDir, { recursive: true });

    if (existsSync(settingsPath)) {
      const data = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(data) as DefaultSettings;
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

export async function saveSettings(
  eventOrSettings: IpcMainInvokeEvent | object | null,
  maybeSettings?: object | null
): Promise<boolean> {
  try {
    const settings =
      typeof maybeSettings === "undefined" || maybeSettings === null
        ? (eventOrSettings as object)
        : maybeSettings;

    await mkdir(configDir, { recursive: true });

    const jsonString = JSON.stringify(settings, null, 2);
    await writeFile(settingsPath, jsonString, { encoding: "utf-8", mode: 0o644 });

    return true;
  } catch (error) {
    console.error("[Main:SettingsManager] Error saving settings:", error);
    return false;
  }
}
