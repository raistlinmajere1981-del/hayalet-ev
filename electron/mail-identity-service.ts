import type {
  AppSettings,
  LocalMailAccountSummary,
  LocalMailAccountConnectionState,
  MailTransportAccountConfig,
  RemoteUserIdentity,
} from "@shared/settings.js";
import type {
  Us1AcceptRemoteUserParams,
  Us1DeleteMailAccountParams,
  Us1DeleteMailAccountResult,
  Us1InviteRemoteUserParams,
  Us1MailAccountDraft,
  Us1MailAccountMutationResult,
  Us1RemoteUserMutationResult,
  Us1StateSnapshot,
  Us1SyncRemoteUsersParams,
} from "@shared/us1-mail.js";

import { google } from "googleapis";
import * as http from "http";
import { normalizeSettings } from "../src/js/modules/settings/settings-schema.ts";
import { applyMailTransportAccountDefaults, MailTransportService } from "./mail-transport/index.js";
import type {
  FetchInboxResult,
  ProbeMailAccountResult,
  SendMailRequest,
  SendMailResult,
} from "./mail-transport/index.js";

const HANDSHAKE_PROTOCOL = "hayalet-ev-us1-handshake";
const HANDSHAKE_VERSION = 1;
const PAYLOAD_START = "--- HAYALET_EV_US1_PAYLOAD ---";
const PAYLOAD_END = "--- /HAYALET_EV_US1_PAYLOAD ---";

type HandshakeMessageType = "invite" | "accept" | "profile";

interface HandshakeEnvelope {
  protocol: typeof HANDSHAKE_PROTOCOL;
  version: typeof HANDSHAKE_VERSION;
  messageType: HandshakeMessageType;
  inviteId: string;
  sentAt: number;
  profile: {
    remoteUserId: string;
    email: string;
    nickname: string;
    avatar: string;
    profileRevision: number;
  };
}

interface MailTransportFacade {
  probeAccount(accountConfig: MailTransportAccountConfig): Promise<ProbeMailAccountResult>;
  sendMail(
    accountConfig: MailTransportAccountConfig,
    message: SendMailRequest
  ): Promise<SendMailResult>;
  fetchInbox(
    accountConfig: MailTransportAccountConfig,
    request?: { limit?: number }
  ): Promise<FetchInboxResult>;
}

interface MailIdentitySettingsStore {
  loadSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<boolean>;
}

async function loadPersistedSettings(): Promise<AppSettings | null> {
  const settingsModule = await import("./settings-manager.ts");
  return await settingsModule.loadSettings();
}

async function persistSettingsToDisk(settings: AppSettings): Promise<boolean> {
  const settingsModule = await import("./settings-manager.ts");
  return await settingsModule.saveSettings(settings);
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeEmail(value: unknown): string {
  return normalizeOptionalText(value)?.toLowerCase() ?? "";
}

function buildRemoteUserId(email: string): string {
  return normalizeEmail(email);
}

function buildMailAccountId(email: string, providerType: string): string {
  const normalizedEmail = normalizeEmail(email);
  const seed = normalizedEmail !== "" ? normalizedEmail : providerType;
  return `mail_${seed.replace(/[^a-z0-9]+/g, "_")}`;
}

function buildInviteId(now: number): string {
  return `invite_${now}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildLocalMessageId(prefix: string, token: string, now: number): string {
  const normalizedToken = token
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${prefix}:${normalizedToken !== "" ? normalizedToken : "mail"}:${now}`;
}

function buildHandshakeSubject(messageType: HandshakeMessageType): string {
  if (messageType === "invite") {
    return "[Hayalet Ev] US1 Invite";
  }
  if (messageType === "accept") {
    return "[Hayalet Ev] US1 Accept";
  }
  return "[Hayalet Ev] US1 Profile";
}

function serializeHandshakeEnvelope(envelope: HandshakeEnvelope): string {
  return [
    "Hayalet Ev US1 handshake payload.",
    "",
    PAYLOAD_START,
    JSON.stringify(envelope, null, 2),
    PAYLOAD_END,
    "",
  ].join("\n");
}

function extractHandshakeEnvelope(text: string): HandshakeEnvelope | null {
  const match = text.match(
    /--- HAYALET_EV_US1_PAYLOAD ---\s*([\s\S]+?)\s*--- \/HAYALET_EV_US1_PAYLOAD ---/
  );
  if (match === null) {
    return null;
  }

  try {
    const payload = match[1];
    if (payload === undefined) {
      return null;
    }

    const parsed = JSON.parse(payload) as Partial<HandshakeEnvelope> | null;
    if (
      parsed?.protocol !== HANDSHAKE_PROTOCOL ||
      parsed.version !== HANDSHAKE_VERSION ||
      (parsed.messageType !== "invite" &&
        parsed.messageType !== "accept" &&
        parsed.messageType !== "profile")
    ) {
      return null;
    }

    const profile = parsed.profile;
    const remoteUserId = buildRemoteUserId(profile?.email ?? profile?.remoteUserId ?? "");
    const email = normalizeEmail(profile?.email);
    if (remoteUserId === "" || email === "") {
      return null;
    }

    return {
      protocol: HANDSHAKE_PROTOCOL,
      version: HANDSHAKE_VERSION,
      messageType: parsed.messageType,
      inviteId: normalizeOptionalText(parsed.inviteId) ?? buildInviteId(Date.now()),
      sentAt:
        typeof parsed.sentAt === "number" && Number.isFinite(parsed.sentAt) && parsed.sentAt >= 0
          ? Math.trunc(parsed.sentAt)
          : Date.now(),
      profile: {
        remoteUserId,
        email,
        nickname: normalizeOptionalText(profile?.nickname) ?? email,
        avatar: normalizeOptionalText(profile?.avatar) ?? "",
        profileRevision:
          typeof profile?.profileRevision === "number" &&
          Number.isFinite(profile.profileRevision) &&
          profile.profileRevision >= 1
            ? Math.trunc(profile.profileRevision)
            : 1,
      },
    };
  } catch {
    return null;
  }
}

function parseHandshakeHeaderValue(headerLines: string[], headerName: string): string | null {
  const lowerHeaderName = headerName.toLowerCase();
  for (const line of headerLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    if (key !== lowerHeaderName) {
      continue;
    }
    return normalizeOptionalText(line.slice(separatorIndex + 1));
  }
  return null;
}

function sortRemoteUsers(remoteUsers: RemoteUserIdentity[]): RemoteUserIdentity[] {
  const rank: Record<RemoteUserIdentity["handshakeState"], number> = {
    active: 0,
    handshake_pending: 1,
    invite_sent: 2,
    error: 3,
  };

  return [...remoteUsers].sort((left, right) => {
    const stateDelta = rank[left.handshakeState] - rank[right.handshakeState];
    if (stateDelta !== 0) {
      return stateDelta;
    }
    return `${left.nickname ?? left.email}`.localeCompare(`${right.nickname ?? right.email}`, "tr");
  });
}

export class MailIdentityService {
  private transport: MailTransportFacade;
  private now: () => number;
  private settingsStore: MailIdentitySettingsStore;

  constructor(
    options: {
      transport?: MailTransportFacade;
      now?: () => number;
      settingsStore?: Partial<MailIdentitySettingsStore>;
    } = {}
  ) {
    this.transport = options.transport ?? new MailTransportService();
    this.now = options.now ?? ((): number => Date.now());
    this.settingsStore = {
      loadSettings: options.settingsStore?.loadSettings ?? loadPersistedSettings,
      saveSettings: options.settingsStore?.saveSettings ?? persistSettingsToDisk,
    };
  }

  async startGmailOauth(): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      const settings = await this.loadNormalizedSettings();
      const gconf = settings.integrations?.googledrive ?? {};
      const clientId = (gconf as any).clientId ?? process.env["GOOGLE_CLIENT_ID"] ?? "";
      const clientSecret = (gconf as any).clientSecret ?? process.env["GOOGLE_CLIENT_SECRET"] ?? "";

      if (!clientId || !clientSecret) {
        return {
          success: false,
          error: "Google Client ID or Client Secret is missing in Drive settings.",
        };
      }

      // Try loopback first, fallback to oob if requested or failed
      const redirect = "http://localhost:3322";
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
          "https://mail.google.com/",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ],
      });

      return { success: true, authUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async exchangeGmailCode(
    code: string
  ): Promise<{ success: boolean; email?: string; tokens?: any; error?: string }> {
    try {
      const settings = await this.loadNormalizedSettings();
      const gconf = settings.integrations?.googledrive ?? {};
      const clientId = (gconf as any).clientId ?? process.env["GOOGLE_CLIENT_ID"] ?? "";
      const clientSecret = (gconf as any).clientSecret ?? process.env["GOOGLE_CLIENT_SECRET"] ?? "";

      if (!clientId || !clientSecret) {
        return {
          success: false,
          error: "Google Client ID or Client Secret is missing in Drive settings.",
        };
      }

      // We use localhost for exchange if it looks like a code from there, otherwise oob
      const redirect = code.length > 50 ? "http://localhost:3322" : "urn:ietf:wg:oauth:2.0:oob";
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect);

      const { tokens } = await oauth2Client.getToken(code.trim());
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email ?? "";

      return { success: true, email, tokens };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async listenForGmailCode(): Promise<{ success: boolean; code?: string; error?: string }> {
    return new Promise((resolve) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url?.startsWith("/?code=")) {
            const code = new URL(req.url, "http://localhost:3322").searchParams.get("code");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              "<h1>Bağlantı Başarılı!</h1><p>Hayalet Ev'e geri dönebilirsiniz. Bu pencereyi kapatabilirsiniz.</p>"
            );
            server.close();
            resolve({ success: true, code: code ?? "" });
          } else {
            res.writeHead(404);
            res.end();
          }
        } catch (err) {
          res.writeHead(500);
          res.end();
          server.close();
          resolve({ success: false, error: String(err) });
        }
      });

      server.listen(3322, () => {
        // Timeout after 5 minutes
        setTimeout(
          () => {
            server.close();
            resolve({ success: false, error: "Zaman aşımı. Lütfen tekrar deneyin." });
          },
          5 * 60 * 1000
        );
      });

      server.on("error", (err) => {
        resolve({ success: false, error: String(err) });
      });
    });
  }

  async upsertMailAccount(
    draft: Us1MailAccountDraft,
    options: { verifyAfterSave?: boolean } = {}
  ): Promise<Us1MailAccountMutationResult> {
    const settings = await this.loadNormalizedSettings();
    const accounts = this.getMailAccounts(settings);
    const normalizedEmail = normalizeEmail(draft.email);

    if (normalizedEmail === "") {
      return { success: false, error: "Mail account email is required." };
    }

    const requestedId = normalizeOptionalText(draft.mailAccountId);
    const existingIndex = accounts.findIndex((account) => {
      if (requestedId !== null) {
        return account.id === requestedId;
      }
      return (
        account.email.toLowerCase() === normalizedEmail &&
        account.providerType === draft.providerType
      );
    });
    const existingAccount = existingIndex >= 0 ? (accounts[existingIndex] ?? null) : null;
    const nextAccountId =
      requestedId ?? existingAccount?.id ?? buildMailAccountId(normalizedEmail, draft.providerType);
    const nextAccount = this.buildMailAccountConfig(nextAccountId, draft, existingAccount);

    if (
      accounts.some(
        (account, index) =>
          index !== existingIndex &&
          account.email.toLowerCase() === nextAccount.email.toLowerCase() &&
          account.providerType === nextAccount.providerType
      )
    ) {
      return {
        success: false,
        error: "A local mail account with the same email and provider already exists.",
      };
    }

    if (existingIndex >= 0) {
      accounts[existingIndex] = nextAccount;
    } else {
      accounts.push(nextAccount);
    }

    this.setMailAccounts(settings, accounts);

    if (options.verifyAfterSave === true) {
      return await this.verifyMailAccountInternal(settings, nextAccount.id);
    }

    await this.persistSettings(settings);
    const localMailAccount = this.toLocalMailAccountSummary(accounts, nextAccount.id);
    return {
      success: true,
      ...(localMailAccount !== undefined ? { localMailAccount } : {}),
      state: this.buildStateSnapshot(settings, nextAccount.id),
    };
  }

  async verifyMailAccount(mailAccountId: string): Promise<Us1MailAccountMutationResult> {
    const settings = await this.loadNormalizedSettings();
    return await this.verifyMailAccountInternal(settings, mailAccountId);
  }

  async deleteMailAccount(params: Us1DeleteMailAccountParams): Promise<Us1DeleteMailAccountResult> {
    const settings = await this.loadNormalizedSettings();
    const accounts = this.getMailAccounts(settings);
    const normalizedMailAccountId = normalizeOptionalText(params.mailAccountId);

    if (normalizedMailAccountId === null) {
      return { success: false, error: "mailAccountId is required." };
    }

    const nextAccounts = accounts.filter((account) => account.id !== normalizedMailAccountId);
    if (nextAccounts.length === accounts.length) {
      return { success: false, error: `Mail account not found: ${normalizedMailAccountId}` };
    }

    this.setMailAccounts(settings, nextAccounts);
    const removedRemoteUserIds = new Set(
      (settings.remoteUsers ?? [])
        .filter((remoteUser) => remoteUser.linkedMailAccountId === normalizedMailAccountId)
        .map((remoteUser) => remoteUser.remoteUserId)
    );
    settings.remoteUsers = (settings.remoteUsers ?? []).filter(
      (remoteUser) => remoteUser.linkedMailAccountId !== normalizedMailAccountId
    );
    settings.accounts = (settings.accounts ?? []).filter((account) => {
      const remoteUserId =
        normalizeOptionalText(account.remoteEmail?.remoteUserId) ?? normalizeEmail(account.email);
      return (
        account.provider !== "remote-email" &&
        account.accountKind !== "remote-email"
      ) || !removedRemoteUserIds.has(remoteUserId);
    });

    if (settings.us1Slot?.selectedRemoteUserId !== null) {
      const selectedRemoteUserId = settings.us1Slot?.selectedRemoteUserId ?? null;
      const hasSelectedRemoteUser = (settings.remoteUsers ?? []).some(
        (remoteUser) =>
          remoteUser.remoteUserId === selectedRemoteUserId && remoteUser.handshakeState === "active"
      );
      if (!hasSelectedRemoteUser && settings.us1Slot) {
        settings.us1Slot.selectedRemoteUserId = null;
        settings.us1Slot.selectedAccountId = null;
        settings.us1Slot.connectionState = "disconnected";
      }
    }

    await this.persistSettings(settings);
    return {
      success: true,
      state: this.buildStateSnapshot(settings),
    };
  }

  async inviteRemoteUser(params: Us1InviteRemoteUserParams): Promise<Us1RemoteUserMutationResult> {
    const settings = await this.loadNormalizedSettings();
    const account = this.findMailAccount(settings, params.mailAccountId);
    if (account === null) {
      return { success: false, error: `Mail account not found: ${params.mailAccountId}` };
    }
    if (account.enabled === false) {
      return { success: false, error: `Mail account is disabled: ${account.id}` };
    }
    if (account.connectionState !== "connected") {
      return {
        success: false,
        error: `Mail account must be connected before inviting a remote user: ${account.id}`,
      };
    }

    const remoteEmail = normalizeEmail(params.email);
    if (remoteEmail === "") {
      return { success: false, error: "Remote user email is required." };
    }
    if (remoteEmail === normalizeEmail(account.email)) {
      return { success: false, error: "A local mail account cannot invite itself." };
    }

    const remoteUserId = buildRemoteUserId(remoteEmail);
    const existingRemoteUser = this.findRemoteUser(settings, remoteUserId);
    if (existingRemoteUser?.handshakeState === "active") {
      return { success: false, error: `Remote user is already active: ${remoteEmail}` };
    }

    const profile = this.buildLocalProfile(settings, account);
    const inviteId = buildInviteId(this.now());

    try {
      const sendResult = await this.transport.sendMail(account, {
        localMessageId: buildLocalMessageId("us1-invite", remoteUserId, this.now()),
        remoteUserId,
        to: remoteEmail,
        subject: buildHandshakeSubject("invite"),
        text: serializeHandshakeEnvelope({
          protocol: HANDSHAKE_PROTOCOL,
          version: HANDSHAKE_VERSION,
          messageType: "invite",
          inviteId,
          sentAt: this.now(),
          profile,
        }),
        headers: {
          "X-Hayalet-Ev-Protocol": HANDSHAKE_PROTOCOL,
          "X-Hayalet-Ev-Message-Type": "invite",
        },
      });

      const remoteUser = this.upsertRemoteUser(settings, {
        remoteUserId,
        email: remoteEmail,
        nickname:
          normalizeOptionalText(params.nickname) ?? existingRemoteUser?.nickname ?? remoteEmail,
        avatar: existingRemoteUser?.avatar ?? "",
        avatarPath: existingRemoteUser?.avatarPath ?? "",
        handshakeState: "invite_sent",
        profileRevision: existingRemoteUser?.profileRevision ?? 1,
        linkedMailAccountId: account.id,
        inviteMessageId: sendResult.transportMessageId,
        acceptMessageId: existingRemoteUser?.acceptMessageId ?? null,
        threadMessageId: sendResult.threadMessageId ?? sendResult.transportMessageId,
        lastTransportMessageId: sendResult.transportMessageId,
        lastSyncAt: this.now(),
        lastError: null,
      });

      await this.persistSettings(settings);
      return {
        success: true,
        remoteUser,
        remoteUsers: sortRemoteUsers(settings.remoteUsers ?? []),
        state: this.buildStateSnapshot(settings, account.id),
      };
    } catch (error) {
      const remoteUser = this.upsertRemoteUser(settings, {
        remoteUserId,
        email: remoteEmail,
        nickname:
          normalizeOptionalText(params.nickname) ?? existingRemoteUser?.nickname ?? remoteEmail,
        avatar: existingRemoteUser?.avatar ?? "",
        avatarPath: existingRemoteUser?.avatarPath ?? "",
        handshakeState: "error",
        profileRevision: existingRemoteUser?.profileRevision ?? 1,
        linkedMailAccountId: account.id,
        inviteMessageId: existingRemoteUser?.inviteMessageId ?? null,
        acceptMessageId: existingRemoteUser?.acceptMessageId ?? null,
        threadMessageId: existingRemoteUser?.threadMessageId ?? null,
        lastTransportMessageId: existingRemoteUser?.lastTransportMessageId ?? null,
        lastSyncAt: this.now(),
        lastError: error instanceof Error ? error.message : String(error),
      });

      await this.persistSettings(settings);
      return {
        success: false,
        remoteUser,
        remoteUsers: sortRemoteUsers(settings.remoteUsers ?? []),
        state: this.buildStateSnapshot(settings, account.id),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async acceptRemoteUser(params: Us1AcceptRemoteUserParams): Promise<Us1RemoteUserMutationResult> {
    const settings = await this.loadNormalizedSettings();
    const remoteUserId = normalizeOptionalText(params.remoteUserId);
    if (remoteUserId === null) {
      return { success: false, error: "remoteUserId is required." };
    }

    const remoteUser = this.findRemoteUser(settings, remoteUserId);
    if (remoteUser === null) {
      return { success: false, error: `Remote user not found: ${remoteUserId}` };
    }
    if (remoteUser.handshakeState !== "handshake_pending") {
      return {
        success: false,
        error: `Remote user must be in handshake_pending state before accept: ${remoteUserId}`,
      };
    }

    const account = this.findMailAccount(settings, remoteUser.linkedMailAccountId);
    if (account === null) {
      return {
        success: false,
        error: `Linked mail account not found: ${remoteUser.linkedMailAccountId}`,
      };
    }
    if (account.connectionState !== "connected") {
      return {
        success: false,
        error: `Mail account must be connected before accept: ${account.id}`,
      };
    }

    const profile = this.buildLocalProfile(settings, account);

    try {
      const replyReference = remoteUser.threadMessageId ?? remoteUser.inviteMessageId ?? null;
      const sendResult = await this.transport.sendMail(account, {
        localMessageId: buildLocalMessageId("us1-accept", remoteUser.remoteUserId, this.now()),
        remoteUserId: remoteUser.remoteUserId,
        to: remoteUser.email,
        subject: buildHandshakeSubject("accept"),
        text: serializeHandshakeEnvelope({
          protocol: HANDSHAKE_PROTOCOL,
          version: HANDSHAKE_VERSION,
          messageType: "accept",
          inviteId: remoteUser.inviteMessageId ?? buildInviteId(this.now()),
          sentAt: this.now(),
          profile,
        }),
        headers: {
          "X-Hayalet-Ev-Protocol": HANDSHAKE_PROTOCOL,
          "X-Hayalet-Ev-Message-Type": "accept",
        },
        ...(remoteUser.inviteMessageId !== null ? { inReplyTo: remoteUser.inviteMessageId } : {}),
        ...(replyReference !== null
          ? { references: replyReference, threadMessageId: replyReference }
          : {}),
      });

      const nextRemoteUser = this.upsertRemoteUser(settings, {
        ...remoteUser,
        handshakeState: "active",
        acceptMessageId: sendResult.transportMessageId,
        threadMessageId:
          remoteUser.threadMessageId ?? sendResult.threadMessageId ?? sendResult.transportMessageId,
        lastTransportMessageId: sendResult.transportMessageId,
        lastSyncAt: this.now(),
        lastError: null,
      });

      await this.persistSettings(settings);
      return {
        success: true,
        remoteUser: nextRemoteUser,
        remoteUsers: sortRemoteUsers(settings.remoteUsers ?? []),
        state: this.buildStateSnapshot(settings, account.id),
      };
    } catch (error) {
      const nextRemoteUser = this.upsertRemoteUser(settings, {
        ...remoteUser,
        handshakeState: "error",
        lastSyncAt: this.now(),
        lastError: error instanceof Error ? error.message : String(error),
      });

      await this.persistSettings(settings);
      return {
        success: false,
        remoteUser: nextRemoteUser,
        remoteUsers: sortRemoteUsers(settings.remoteUsers ?? []),
        state: this.buildStateSnapshot(settings, account.id),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncRemoteUsers(
    params: Us1SyncRemoteUsersParams = {}
  ): Promise<Us1RemoteUserMutationResult> {
    const settings = await this.loadNormalizedSettings();
    const allAccounts = this.getMailAccounts(settings).filter(
      (account) => account.enabled !== false
    );
    const accountList =
      normalizeOptionalText(params.mailAccountId) === null
        ? allAccounts
        : allAccounts.filter(
            (account) => account.id === normalizeOptionalText(params.mailAccountId)
          );

    if (accountList.length === 0) {
      return { success: false, error: "No local mail account is available for handshake sync." };
    }

    let fetchedCount = 0;
    let processedCount = 0;
    let duplicateCount = 0;
    let lastError: string | null = null;

    for (const account of accountList) {
      try {
        // eslint-disable-next-line no-await-in-loop -- NOTE: handshake sync is sequential per account.
        const fetchResult = await this.transport.fetchInbox(account, {
          ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
        });
        fetchedCount += fetchResult.fetchedCount;
        processedCount += fetchResult.processedCount;
        duplicateCount += fetchResult.duplicateCount;

        this.applyFetchedHandshakeMessages(settings, account, fetchResult);
        this.updateMailAccountConnection(settings, account.id, {
          connectionState: "connected",
          lastConnectionError: null,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.updateMailAccountConnection(settings, account.id, {
          connectionState: "error",
          lastConnectionError: lastError,
        });
      }
    }

    await this.persistSettings(settings);

    return {
      success: lastError === null,
      remoteUsers: sortRemoteUsers(settings.remoteUsers ?? []),
      state: this.buildStateSnapshot(settings, normalizeOptionalText(params.mailAccountId)),
      fetchedCount,
      processedCount,
      duplicateCount,
      ...(lastError !== null ? { error: lastError } : {}),
    };
  }

  private async verifyMailAccountInternal(
    settings: AppSettings,
    mailAccountId: string
  ): Promise<Us1MailAccountMutationResult> {
    const normalizedMailAccountId = normalizeOptionalText(mailAccountId);
    if (normalizedMailAccountId === null) {
      return { success: false, error: "mailAccountId is required." };
    }

    const account = this.findMailAccount(settings, normalizedMailAccountId);
    if (account === null) {
      return { success: false, error: `Mail account not found: ${normalizedMailAccountId}` };
    }

    try {
      await this.transport.probeAccount(account);
      this.updateMailAccountConnection(settings, normalizedMailAccountId, {
        connectionState: "connected",
        lastConnectionError: null,
      });
      this.setVerifiedLocalMailAccount(settings, normalizedMailAccountId);

      await this.persistSettings(settings);
      const localMailAccount = this.toLocalMailAccountSummary(
        this.getMailAccounts(settings),
        normalizedMailAccountId
      );
      return {
        success: true,
        ...(localMailAccount !== undefined ? { localMailAccount } : {}),
        state: this.buildStateSnapshot(settings, normalizedMailAccountId),
      };
    } catch (error) {
      this.updateMailAccountConnection(settings, normalizedMailAccountId, {
        connectionState: "error",
        lastConnectionError: error instanceof Error ? error.message : String(error),
      });

      await this.persistSettings(settings);
      const localMailAccount = this.toLocalMailAccountSummary(
        this.getMailAccounts(settings),
        normalizedMailAccountId
      );
      return {
        success: false,
        ...(localMailAccount !== undefined ? { localMailAccount } : {}),
        state: this.buildStateSnapshot(settings, normalizedMailAccountId),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async loadNormalizedSettings(): Promise<AppSettings> {
    return normalizeSettings((await this.settingsStore.loadSettings()) ?? {});
  }

  private async persistSettings(settings: AppSettings): Promise<void> {
    const saved = await this.settingsStore.saveSettings(settings);
    if (saved !== true) {
      throw new Error("Failed to persist mail identity settings.");
    }
  }

  private getMailAccounts(settings: AppSettings): MailTransportAccountConfig[] {
    return settings.integrations?.mailTransport?.accounts ?? [];
  }

  private setMailAccounts(settings: AppSettings, accounts: MailTransportAccountConfig[]): void {
    settings.integrations ??= {};
    settings.integrations.mailTransport ??= {
      accounts: [],
      localAccount: null,
      retryBaseMs: 1500,
      maxRetries: 2,
    };
    settings.integrations.mailTransport.accounts = accounts;

    const verifiedLocalMailAccountId = this.getVerifiedLocalMailAccountId(settings);
    if (
      verifiedLocalMailAccountId !== null &&
      !accounts.some((account) => account.id === verifiedLocalMailAccountId)
    ) {
      this.setVerifiedLocalMailAccount(
        settings,
        accounts.find(
          (account) => account.enabled !== false && account.connectionState === "connected"
        )?.id ?? null
      );
    }
  }

  private getVerifiedLocalMailAccountId(settings: AppSettings): string | null {
    return normalizeOptionalText(settings.integrations?.mailTransport?.localAccount?.id);
  }

  private setVerifiedLocalMailAccount(
    settings: AppSettings,
    mailAccountId: string | null
  ): void {
    settings.integrations ??= {};
    settings.integrations.mailTransport ??= {
      accounts: [],
      localAccount: null,
      retryBaseMs: 1500,
      maxRetries: 2,
    };

    const verifiedLocalMailAccount =
      mailAccountId === null ? null : this.findMailAccount(settings, mailAccountId);

    settings.integrations.mailTransport.localAccount =
      verifiedLocalMailAccount !== null ? { ...verifiedLocalMailAccount } : null;

    settings.user ??= {};
    settings.user.email =
      verifiedLocalMailAccount !== null ? normalizeEmail(verifiedLocalMailAccount.email) : "";
  }

  private findMailAccount(
    settings: AppSettings,
    mailAccountId: string
  ): MailTransportAccountConfig | null {
    return this.getMailAccounts(settings).find((account) => account.id === mailAccountId) ?? null;
  }

  private findRemoteUser(settings: AppSettings, remoteUserId: string): RemoteUserIdentity | null {
    return (
      (settings.remoteUsers ?? []).find((remoteUser) => remoteUser.remoteUserId === remoteUserId) ??
      null
    );
  }

  private buildMailAccountConfig(
    nextAccountId: string,
    draft: Us1MailAccountDraft,
    existingAccount: MailTransportAccountConfig | null
  ): MailTransportAccountConfig {
    const normalizedEmail = normalizeEmail(draft.email);

    return applyMailTransportAccountDefaults({
      id: nextAccountId,
      providerType: draft.providerType,
      email: normalizedEmail,
      enabled: draft.enabled !== false,
      connectionState: "disconnected",
      lastConnectionError: null,
      authType: draft.authType,
      imap: {
        host: normalizeOptionalText(draft.imap?.host) ?? existingAccount?.imap.host ?? "",
        port:
          typeof draft.imap?.port === "number" &&
          Number.isInteger(draft.imap.port) &&
          draft.imap.port > 0
            ? draft.imap.port
            : (existingAccount?.imap.port ?? 0),
        secure:
          typeof draft.imap?.secure === "boolean"
            ? draft.imap.secure
            : (existingAccount?.imap.secure ?? false),
      },
      smtp: {
        host: normalizeOptionalText(draft.smtp?.host) ?? existingAccount?.smtp.host ?? "",
        port:
          typeof draft.smtp?.port === "number" &&
          Number.isInteger(draft.smtp.port) &&
          draft.smtp.port > 0
            ? draft.smtp.port
            : (existingAccount?.smtp.port ?? 0),
        secure:
          typeof draft.smtp?.secure === "boolean"
            ? draft.smtp.secure
            : (existingAccount?.smtp.secure ?? false),
      },
      auth: {
        user:
          normalizeOptionalText(draft.auth?.user) ?? existingAccount?.auth.user ?? normalizedEmail,
        password:
          normalizeOptionalText(draft.auth?.password) ?? existingAccount?.auth.password ?? "",
        accessToken:
          normalizeOptionalText(draft.auth?.accessToken) ?? existingAccount?.auth.accessToken ?? "",
        refreshToken:
          normalizeOptionalText(draft.auth?.refreshToken) ??
          existingAccount?.auth.refreshToken ??
          "",
        clientId:
          normalizeOptionalText(draft.auth?.clientId) ?? existingAccount?.auth.clientId ?? "",
        clientSecret:
          normalizeOptionalText(draft.auth?.clientSecret) ??
          existingAccount?.auth.clientSecret ??
          "",
        expiresAt:
          typeof draft.auth?.expiresAt === "number" && Number.isFinite(draft.auth.expiresAt)
            ? Math.trunc(draft.auth.expiresAt)
            : (existingAccount?.auth.expiresAt ?? 0),
        loginMethod:
          normalizeOptionalText(draft.auth?.loginMethod) ?? existingAccount?.auth.loginMethod ?? "",
      },
      defaultMailbox: existingAccount?.defaultMailbox ?? "INBOX",
      fetchBatchSize: existingAccount?.fetchBatchSize ?? 20,
      ...(existingAccount?.binding !== undefined ? { binding: existingAccount.binding } : {}),
    });
  }

  private toLocalMailAccountSummary(
    accounts: MailTransportAccountConfig[],
    mailAccountId: string
  ): LocalMailAccountSummary | undefined {
    const index = accounts.findIndex((account) => account.id === mailAccountId);
    if (index < 0) {
      return undefined;
    }

    const account = accounts[index];
    if (account === undefined) {
      return undefined;
    }
    const configRef = `integrations.mailTransport.accounts.${index}`;
    return {
      mailAccountId: account.id,
      providerType: account.providerType,
      email: account.email,
      authType: account.authType,
      authConfigRef: `${configRef}.auth`,
      configRef,
      connectionState: account.connectionState ?? "disconnected",
      enabled: account.enabled !== false,
      lastConnectionError: account.lastConnectionError ?? null,
    };
  }

  private buildStateSnapshot(
    settings: AppSettings,
    preferredMailAccountId: string | null = null
  ): Us1StateSnapshot {
    const localMailAccounts = this.getMailAccounts(settings)
      .map((account) => this.toLocalMailAccountSummary(this.getMailAccounts(settings), account.id))
      .filter((account): account is LocalMailAccountSummary => account !== undefined);
    const remoteUsers = sortRemoteUsers(settings.remoteUsers ?? []);
    const activeRemoteUsers = remoteUsers.filter(
      (remoteUser) => remoteUser.handshakeState === "active"
    );
    const selectedMailAccountId = this.resolveSelectedMailAccountId(
      settings,
      localMailAccounts,
      preferredMailAccountId
    );
    const selectedMailAccount = localMailAccounts.find(
      (localMailAccount) => localMailAccount.mailAccountId === selectedMailAccountId
    );
    const verifiedLocalMailAccountId = this.getVerifiedLocalMailAccountId(settings);

    return {
      localMailAccounts,
      remoteUsers,
      activeRemoteUsers,
      us1Slot: settings.us1Slot ?? {
        selectedRemoteUserId: null,
        connectionState: "disconnected",
        catchCommands: false,
      },
      selectedMailAccountId,
      selectedRemoteAccountId: normalizeOptionalText(settings.us1Slot?.selectedAccountId),
      verifiedLocalMailAccountId,
      verifiedUserEmail: normalizeOptionalText(settings.user?.email),
      canAddRemoteUser:
        selectedMailAccount?.enabled === true &&
        selectedMailAccount.connectionState === "connected",
    };
  }

  private resolveSelectedMailAccountId(
    settings: AppSettings,
    localMailAccounts: LocalMailAccountSummary[],
    preferredMailAccountId: string | null
  ): string | null {
    const verifiedLocalMailAccountId = this.getVerifiedLocalMailAccountId(settings);
    if (
      verifiedLocalMailAccountId !== null &&
      localMailAccounts.some(
        (localMailAccount) => localMailAccount.mailAccountId === verifiedLocalMailAccountId
      )
    ) {
      return verifiedLocalMailAccountId;
    }

    if (
      preferredMailAccountId !== null &&
      localMailAccounts.some(
        (localMailAccount) => localMailAccount.mailAccountId === preferredMailAccountId
      )
    ) {
      return preferredMailAccountId;
    }

    const selectedRemoteUser = this.findRemoteUser(
      settings,
      settings.us1Slot?.selectedRemoteUserId ?? ""
    );
    if (
      selectedRemoteUser !== null &&
      localMailAccounts.some(
        (localMailAccount) =>
          localMailAccount.mailAccountId === selectedRemoteUser.linkedMailAccountId
      )
    ) {
      return selectedRemoteUser.linkedMailAccountId;
    }

    return (
      localMailAccounts.find(
        (localMailAccount) =>
          localMailAccount.enabled === true && localMailAccount.connectionState === "connected"
      )?.mailAccountId ??
      localMailAccounts.find((localMailAccount) => localMailAccount.enabled === true)
        ?.mailAccountId ??
      localMailAccounts[0]?.mailAccountId ??
      null
    );
  }

  private updateMailAccountConnection(
    settings: AppSettings,
    mailAccountId: string,
    patch: {
      connectionState: LocalMailAccountConnectionState;
      lastConnectionError: string | null;
    }
  ): void {
    const accounts = this.getMailAccounts(settings);
    const index = accounts.findIndex((account) => account.id === mailAccountId);
    if (index < 0) {
      return;
    }

    const currentAccount = accounts[index];
    if (currentAccount === undefined) {
      return;
    }

    accounts[index] = {
      ...currentAccount,
      connectionState: patch.connectionState,
      lastConnectionError: patch.lastConnectionError ?? null,
    };
    this.setMailAccounts(settings, accounts);

    if (
      patch.connectionState === "connected" &&
      this.getVerifiedLocalMailAccountId(settings) === null
    ) {
      this.setVerifiedLocalMailAccount(settings, mailAccountId);
    }
  }

  private buildLocalProfile(
    settings: AppSettings,
    account: MailTransportAccountConfig
  ): HandshakeEnvelope["profile"] {
    const nickname =
      normalizeOptionalText(settings.user?.nickname) ?? normalizeEmail(account.email);
    const rawAvatar = normalizeOptionalText(settings.user?.avatarPath) ?? "";
    const avatar =
      rawAvatar.startsWith("https://") ||
      rawAvatar.startsWith("http://") ||
      rawAvatar.startsWith("data:")
        ? rawAvatar
        : "";

    return {
      remoteUserId: buildRemoteUserId(account.email),
      email: normalizeEmail(account.email),
      nickname,
      avatar,
      profileRevision: this.now(),
    };
  }

  private applyFetchedHandshakeMessages(
    settings: AppSettings,
    account: MailTransportAccountConfig,
    fetchResult: FetchInboxResult
  ): void {
    for (const message of fetchResult.messages) {
      if (message.duplicate) {
        continue;
      }

      const protocolHeader = parseHandshakeHeaderValue(
        message.parsed.headerLines,
        "X-Hayalet-Ev-Protocol"
      );
      if (protocolHeader !== HANDSHAKE_PROTOCOL) {
        continue;
      }

      const envelope = extractHandshakeEnvelope(message.parsed.text);
      if (envelope === null) {
        continue;
      }

      if (envelope.messageType === "invite") {
        this.handleIncomingInvite(settings, account, message.transportMessageId, envelope);
        continue;
      }

      if (envelope.messageType === "accept") {
        this.handleIncomingAccept(settings, account, message.transportMessageId, envelope);
        continue;
      }

      this.handleIncomingProfile(settings, account, message.transportMessageId, envelope);
    }
  }

  private handleIncomingInvite(
    settings: AppSettings,
    account: MailTransportAccountConfig,
    transportMessageId: string | null,
    envelope: HandshakeEnvelope
  ): void {
    const existingRemoteUser = this.findRemoteUser(settings, envelope.profile.remoteUserId);
    const nextState =
      existingRemoteUser?.handshakeState === "active" ? "active" : "handshake_pending";

    this.upsertRemoteUser(settings, {
      remoteUserId: envelope.profile.remoteUserId,
      email: envelope.profile.email,
      nickname: envelope.profile.nickname,
      avatar: envelope.profile.avatar,
      avatarPath: existingRemoteUser?.avatarPath ?? "",
      handshakeState: nextState,
      profileRevision: envelope.profile.profileRevision,
      linkedMailAccountId: account.id,
      inviteMessageId: transportMessageId,
      acceptMessageId: existingRemoteUser?.acceptMessageId ?? null,
      threadMessageId: existingRemoteUser?.threadMessageId ?? transportMessageId,
      lastTransportMessageId: transportMessageId,
      lastSyncAt: this.now(),
      lastError: null,
    });
  }

  private handleIncomingAccept(
    settings: AppSettings,
    account: MailTransportAccountConfig,
    transportMessageId: string | null,
    envelope: HandshakeEnvelope
  ): void {
    const existingRemoteUser = this.findRemoteUser(settings, envelope.profile.remoteUserId);

    this.upsertRemoteUser(settings, {
      remoteUserId: envelope.profile.remoteUserId,
      email: envelope.profile.email,
      nickname: envelope.profile.nickname,
      avatar: envelope.profile.avatar,
      avatarPath: existingRemoteUser?.avatarPath ?? "",
      handshakeState: "active",
      profileRevision: envelope.profile.profileRevision,
      linkedMailAccountId: existingRemoteUser?.linkedMailAccountId ?? account.id,
      inviteMessageId: existingRemoteUser?.inviteMessageId ?? null,
      acceptMessageId: transportMessageId,
      threadMessageId: existingRemoteUser?.threadMessageId ?? transportMessageId,
      lastTransportMessageId: transportMessageId,
      lastSyncAt: this.now(),
      lastError: null,
    });
  }

  private handleIncomingProfile(
    settings: AppSettings,
    account: MailTransportAccountConfig,
    transportMessageId: string | null,
    envelope: HandshakeEnvelope
  ): void {
    const existingRemoteUser = this.findRemoteUser(settings, envelope.profile.remoteUserId);
    this.upsertRemoteUser(settings, {
      remoteUserId: envelope.profile.remoteUserId,
      email: envelope.profile.email,
      nickname: envelope.profile.nickname,
      avatar: envelope.profile.avatar,
      avatarPath: existingRemoteUser?.avatarPath ?? "",
      handshakeState: existingRemoteUser?.handshakeState ?? "handshake_pending",
      profileRevision: envelope.profile.profileRevision,
      linkedMailAccountId: existingRemoteUser?.linkedMailAccountId ?? account.id,
      inviteMessageId: existingRemoteUser?.inviteMessageId ?? null,
      acceptMessageId: existingRemoteUser?.acceptMessageId ?? null,
      threadMessageId: existingRemoteUser?.threadMessageId ?? transportMessageId,
      lastTransportMessageId: transportMessageId,
      lastSyncAt: this.now(),
      lastError: null,
    });
  }

  private upsertRemoteUser(
    settings: AppSettings,
    candidate: RemoteUserIdentity
  ): RemoteUserIdentity {
    const remoteUsers = settings.remoteUsers ?? [];
    const index = remoteUsers.findIndex(
      (remoteUser) => remoteUser.remoteUserId === candidate.remoteUserId
    );
    const existingRemoteUser = index >= 0 ? (remoteUsers[index] ?? null) : null;

    const shouldApplyIncomingProfile =
      existingRemoteUser === null ||
      candidate.profileRevision >= existingRemoteUser.profileRevision ||
      candidate.handshakeState === "active";
    const nextHandshakeState =
      existingRemoteUser?.handshakeState === "active" &&
      candidate.handshakeState === "handshake_pending"
        ? "active"
        : candidate.handshakeState;

    let resolvedNickname: string;
    let resolvedAvatar: string;
    let resolvedProfileRevision: number;

    if (shouldApplyIncomingProfile === true) {
      resolvedNickname = candidate.nickname ?? candidate.email;
      resolvedAvatar = candidate.avatar ?? "";
      resolvedProfileRevision = candidate.profileRevision;
    } else {
      resolvedNickname = existingRemoteUser.nickname ?? candidate.nickname ?? candidate.email;
      resolvedAvatar = existingRemoteUser.avatar ?? candidate.avatar ?? "";
      resolvedProfileRevision = existingRemoteUser.profileRevision;
    }

    const resolvedLastSyncAt = candidate.lastSyncAt ?? existingRemoteUser?.lastSyncAt;

    const nextRemoteUser: RemoteUserIdentity = {
      remoteUserId: candidate.remoteUserId,
      email: candidate.email,
      nickname: resolvedNickname,
      avatar: resolvedAvatar,
      avatarPath: existingRemoteUser?.avatarPath ?? candidate.avatarPath ?? "",
      handshakeState: nextHandshakeState,
      profileRevision: resolvedProfileRevision,
      linkedMailAccountId: candidate.linkedMailAccountId,
      inviteMessageId: candidate.inviteMessageId ?? existingRemoteUser?.inviteMessageId ?? null,
      acceptMessageId: candidate.acceptMessageId ?? existingRemoteUser?.acceptMessageId ?? null,
      threadMessageId: candidate.threadMessageId ?? existingRemoteUser?.threadMessageId ?? null,
      lastTransportMessageId:
        candidate.lastTransportMessageId ?? existingRemoteUser?.lastTransportMessageId ?? null,
      lastError: candidate.lastError ?? null,
      sessionAlias: candidate.sessionAlias ?? existingRemoteUser?.sessionAlias ?? null,
      ...(resolvedLastSyncAt !== undefined ? { lastSyncAt: resolvedLastSyncAt } : {}),
    };

    if (index >= 0) {
      remoteUsers[index] = nextRemoteUser;
    } else {
      remoteUsers.push(nextRemoteUser);
    }

    settings.remoteUsers = sortRemoteUsers(remoteUsers);
    return nextRemoteUser;
  }
}

export const mailIdentityService = new MailIdentityService();
