import {
  DEFAULT_SCENE_APPEARANCE_SETTINGS,
  DEFAULT_THEME_APPEARANCE_SETTINGS,
  type Account,
  type AppSettings,
} from "./settings.js";
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

export function createDefaultRemoteUsers(): NonNullable<AppSettings["remoteUsers"]> {
  return [];
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

  const defaultMailTransport = {
    accounts: [],
    localAccount: null,
    retryBaseMs: 1500,
    maxRetries: 2,
  } as NonNullable<NonNullable<AppSettings["integrations"]>["mailTransport"]>;

  return {
    general: {
      appearance: { ...DEFAULT_THEME_APPEARANCE_SETTINGS },
      language: DEFAULT_APP_LANGUAGE,
    },
    scene: {
      appearance: { ...DEFAULT_SCENE_APPEARANCE_SETTINGS },
    },
    user: { nickname: "User", email: "", avatarPath: "src/assets/default.png" },
    integrations: {
      googledrive: defaultGoogleDrive,
      mailTransport: defaultMailTransport,
      us1Relay: {
        enabled: false,
        baseUrl: null,
        trustedServerFingerprint: null,
        trustState: "unknown",
        encryptionPublicKey: null,
        encryptionKeyFingerprint: null,
        signingPublicKey: null,
        signingKeyFingerprint: null,
        protocolVersion: 1,
        connectionState: "disconnected",
        lastError: null,
        lastConnectedAt: null,
      },
    },
    accounts: [],
    remoteUsers: createDefaultRemoteUsers(),
    us1Slot: {
      communicationSystem: "mail",
      selectedIdentityId: null,
      selectedRemoteUserId: null,
      selectedAccountId: null,
      connectionState: "disconnected",
      relayConnectionState: "disconnected",
      catchCommands: false,
      resumeLastSession: true,
      rememberConnectionStatus: false,
      lastConnectionState: "disconnected",
    },
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
