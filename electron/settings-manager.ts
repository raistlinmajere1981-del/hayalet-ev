import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import type { IpcMainInvokeEvent } from "electron";
import { Paths } from "./paths.ts";
import { getLoggerCore } from "./logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";

const logger = getLoggerCore();

function getConfigDir(): string {
  return Paths.getConfigDir();
}

function getSettingsPath(): string {
  return join(getConfigDir(), "settings.json");
}

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
    dbPath?: string | null;
    isAsistan: boolean;
  }>;
  slots: {
    ai1: {
      accountId: string | null;
      catchCommands: boolean;
      resumeLastSession: boolean;
      rememberConnectionStatus: boolean;
      lastConnectionState: "connected" | "disconnected";
      messageMethod: string;
      fileMethod: string;
    };
    ai2: {
      accountId: string | null;
      catchCommands: boolean;
      resumeLastSession: boolean;
      rememberConnectionStatus: boolean;
      lastConnectionState: "connected" | "disconnected";
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
    lastConnected: string | null;
    resumeLastSession: boolean;
    keepServersOnAppClose: boolean;
    lastOpencodeUrl: string | null;
    lastOpencodeUiSessionId: string | null;
    lastActiveRelay: string | null;
    disabledMcpServers: string[];
    opencode: {
      binaryPath: string | null;
      defaultPort: number;
      version: string | null;
    };
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
      {
        id: "opencode_ui_opencode_at_opencode_com",
        email: "opencode-ui@opencode.com",
        provider: "opencode-ui",
        nickname: "OpenCode UI",
        avatarPath: "src/assets/opencode.png",
        dbPath: "~/.local/share/opencode/opencode.db",
        isAsistan: true,
      },
    ],
    slots: {
      ai1: {
        accountId: null,
        catchCommands: true,
        resumeLastSession: true,
        rememberConnectionStatus: false,
        lastConnectionState: "disconnected",
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      ai2: {
        accountId: null,
        catchCommands: true,
        resumeLastSession: true,
        rememberConnectionStatus: false,
        lastConnectionState: "disconnected",
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
      preferred: "opencode",
      lastConnected: null,
      resumeLastSession: true,
      keepServersOnAppClose: false,
      lastOpencodeUrl: null,
      lastOpencodeUiSessionId: null,
      lastActiveRelay: null,
      disabledMcpServers: [],
      opencode: {
        binaryPath: null,
        defaultPort: 4096,
        version: null,
      },
    },
    logging: {
      level: LogLevel.INFO,
      verboseModules: [],
      silentModules: [],
      persistLevel: LogLevel.INFO,
      maxMemoryLogs: 200,
      enableStateSnapshots: true,
      snapshotInterval: 60000,
    },
  };
}

export async function loadSettings(): Promise<DefaultSettings | null> {
  try {
    await mkdir(getConfigDir(), { recursive: true });

    if (existsSync(getSettingsPath())) {
      const data = await readFile(getSettingsPath(), "utf-8");
      const parsed = JSON.parse(data) as DefaultSettings;
      return parsed;
    }

    const defaults = getDefaultSettings();
    const jsonString = JSON.stringify(defaults, null, 2);
    await writeFile(getSettingsPath(), jsonString, { encoding: "utf-8", mode: 0o644 });
    await logger.logInternal(LogCategory.SETTINGS, LogLevel.INFO, "Created default settings.json", {
      settingsPath: getSettingsPath(),
    });

    return defaults;
  } catch (error) {
    await logger.logInternal(
      LogCategory.SETTINGS,
      LogLevel.ERROR,
      `Error loading settings: ${(error as Error).message}`,
      {
        settingsPath: getSettingsPath(),
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      }
    );
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

    await mkdir(getConfigDir(), { recursive: true });

    const jsonString = JSON.stringify(settings, null, 2);
    await writeFile(getSettingsPath(), jsonString, { encoding: "utf-8", mode: 0o644 });

    return true;
  } catch (error) {
    await logger.logInternal(
      LogCategory.SETTINGS,
      LogLevel.ERROR,
      `Error saving settings: ${(error as Error).message}`,
      {
        settingsPath: getSettingsPath(),
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      }
    );
    return false;
  }
}
