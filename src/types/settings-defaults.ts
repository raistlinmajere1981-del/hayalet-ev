import type { Account, AppSettings } from "./settings.js";
import { DEFAULT_APP_LANGUAGE } from "./i18n.js";

export const DEFAULT_ASSISTANT_ACCOUNT_ID = "opencode_opencode_at_opencode_com";
export const DEFAULT_OPENCODE_UI_ACCOUNT_ID = "opencode_ui_opencode_at_opencode_com";

export function createDefaultAssistantAccount(): Account {
  return {
    id: DEFAULT_ASSISTANT_ACCOUNT_ID,
    email: "opencode@opencode.com",
    provider: "opencode",
    nickname: "Rovo",
    avatarPath: "src/assets/opencode.png",
  };
}

export function createDefaultOpencodeUiAccount(): Account {
  return {
    id: DEFAULT_OPENCODE_UI_ACCOUNT_ID,
    email: "opencode-ui@opencode.com",
    provider: "opencode-ui",
    nickname: "Rovo",
    avatarPath: "src/assets/opencode.png",
    dbPath: "~/.local/share/opencode/opencode.db",
  };
}

export function createDefaultAssistantAccounts(): Account[] {
  return [createDefaultAssistantAccount(), createDefaultOpencodeUiAccount()];
}

export function createDefaultSettings(): AppSettings {
  const defaultGoogleDrive = {
    connected: false,
    email: "",
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    clientId: "",
    clientSecret: "",
    authorizationCode: "",
    account: "",
  } as NonNullable<NonNullable<AppSettings["integrations"]>["googledrive"]>;

  return {
    general: {
      language: DEFAULT_APP_LANGUAGE,
    },
    user: { nickname: "User", avatarPath: "src/assets/default.png" },
    integrations: {
      googledrive: defaultGoogleDrive,
    },
    accounts: [],
    assistantAccounts: createDefaultAssistantAccounts(),
    slots: {
      ai1: {
        accountId: null,
        catchCommands: true,
        disabledCommands: [],
        resumeLastSession: true,
        rememberConnectionStatus: false,
        lastConnectionState: "disconnected",
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      ai2: {
        accountId: null,
        catchCommands: true,
        disabledCommands: [],
        resumeLastSession: true,
        rememberConnectionStatus: false,
        lastConnectionState: "disconnected",
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
    },
    assistantSlot: {
      accountId: DEFAULT_ASSISTANT_ACCOUNT_ID,
      catchCommands: false,
      disabledCommands: [],
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
      opencodeUi: {
        hiddenProviders: [],
        hiddenModels: [],
        favoriteModels: [],
        defaultModelKey: null,
        lastSelectedModelKey: null,
      },
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
