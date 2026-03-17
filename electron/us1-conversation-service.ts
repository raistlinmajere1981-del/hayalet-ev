import { basename, extname } from "node:path";

import type {
  Account,
  AppSettings,
  MailTransportAccountConfig,
  RemoteUserIdentity,
} from "@shared/settings.js";
import { getRemoteEmailAccounts } from "@shared/settings.js";
import {
  buildRemoteEmailAccountId,
  buildUs1SyntheticSessionUri,
  extractUs1RemoteIdentityIdFromAccountId,
} from "@shared/archive.js";
import type {
  Us1RoomPackageCandidate,
  Us1SessionEvent,
  Us1SessionMode,
  Us1SessionOpenHint,
  Us1SendMessageParams,
  Us1SendMessageResult,
  Us1SyncMessagesParams,
  Us1SyncMessagesResult,
} from "@shared/us1-mail.js";

import { normalizeSettings } from "../src/js/modules/settings/settings-schema.ts";
import { MailSidecarStoreManager } from "./database/mail-sidecar-manager.ts";
import { hashString, normalizeText } from "./database/hash-utils.ts";
import { MailTransportService } from "./mail-transport/index.js";
import type {
  FetchInboxResult,
  MailTransportParsedAttachment,
  SendMailRequest,
  SendMailResult,
} from "./mail-transport/index.js";

const HANDSHAKE_PROTOCOL = "hayalet-ev-us1-handshake";
const HANDSHAKE_VERSION = 1;
const HANDSHAKE_PAYLOAD_START = "--- HAYALET_EV_US1_PAYLOAD ---";
const HANDSHAKE_PAYLOAD_END = "--- /HAYALET_EV_US1_PAYLOAD ---";

const MESSAGE_PROTOCOL = "hayalet-ev-us1-message";
const MESSAGE_VERSION = 1;
const MESSAGE_PAYLOAD_START = "--- HAYALET_EV_US1_MESSAGE_PAYLOAD ---";
const MESSAGE_PAYLOAD_END = "--- /HAYALET_EV_US1_MESSAGE_PAYLOAD ---";
const MESSAGE_TYPE_CONVERSATION = "conversation";
const ROOM_BUNDLE_SUFFIX = ".hevroom.json";
const OUTBOUND_ATTACHMENT_ONLY_TEXT = "Attachment-only message.";
const INBOUND_ATTACHMENT_ONLY_TEXT = "Attachment-only mail message.";
const SUBJECT_PREFIX = "[Hayalet Ev] US1";

type HandshakeMessageType = "invite" | "accept" | "reject" | "profile";

interface HandshakeEnvelope {
  protocol: typeof HANDSHAKE_PROTOCOL;
  version: typeof HANDSHAKE_VERSION;
  messageType: HandshakeMessageType;
  inviteId: string;
  sentAt: number;
  profile: MessageProfile;
}

interface MessageProfile {
  remoteUserId: string;
  email: string;
  nickname: string;
  avatar: string;
  avatarAttachmentName?: string | null;
  profileRevision: number;
}

interface ConversationEnvelope {
  protocol: typeof MESSAGE_PROTOCOL;
  version: typeof MESSAGE_VERSION;
  messageType: typeof MESSAGE_TYPE_CONVERSATION;
  sentAt: number;
  localSessionId: string | null;
  session: ConversationSessionDescriptor | null;
  thread: ConversationThreadDescriptor | null;
  profile: MessageProfile;
}

interface ConversationSessionDescriptor {
  id: string;
  mode: Us1SessionMode;
  title: string | null;
  createdAt: number;
  openHint: Us1SessionOpenHint;
}

interface ConversationThreadDescriptor {
  threadRootMessageId: string | null;
  replyToMessageId: string | null;
}

interface MailTransportFacade {
  sendMail(
    accountConfig: MailTransportAccountConfig,
    message: SendMailRequest
  ): Promise<SendMailResult>;
  fetchInbox(
    accountConfig: MailTransportAccountConfig,
    request?: { limit?: number; includeAttachmentContent?: boolean }
  ): Promise<FetchInboxResult>;
}

interface ConversationSettingsStore {
  loadSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<boolean>;
}

interface ResolvedBinding {
  remoteUser: RemoteUserIdentity;
  account: MailTransportAccountConfig;
}

interface ArchiveContext {
  manager: ArchiveManagerLike;
  archiveAccountId: string;
  webUrl: string;
  conversationId: string;
}

interface ArchiveManagerLike {
  upsertConversationMetadata(params: {
    webUrl: string;
    provider?: string;
    title?: string | null;
  }): Promise<{
    success: boolean;
    data?: {
      conversationId: string;
      created: boolean;
      title: string;
      titleUpdated: boolean;
    };
    error?: string;
  }>;
  getMessages(conversationId: string): Promise<{
    success: boolean;
    data?: Array<unknown>;
    error?: string;
  }>;
  syncMessages(params: {
    accountId: string;
    provider?: string;
    webUrl: string;
    messages: Array<{
      role: "user" | "assistant";
      text: string;
      author?: string;
      index?: number;
      domIndex?: number;
      domId?: string;
      contentHash?: string;
    }>;
  }): Promise<{
    success: boolean;
    conversationId?: string;
    added?: number;
    total?: number;
    error?: string;
  }>;
  saveAttachment(
    conversationId: string,
    messageId: string,
    filePath: string,
    originalName: string,
    mimeType?: string
  ): Promise<{
    success: boolean;
    data?: { attachmentId: string; storedPath: string };
    error?: string;
  }>;
  saveAttachmentContent(
    conversationId: string,
    messageId: string,
    content: Buffer,
    originalName: string,
    mimeType?: string
  ): Promise<{
    success: boolean;
    data?: { attachmentId: string; storedPath: string };
    error?: string;
  }>;
}

type ArchiveManagerFactory = (accountId: string) => Promise<ArchiveManagerLike>;

interface AttachmentArchiveRef {
  attachmentId?: string;
  originalName: string;
  storedPath: string;
  mimeType?: string | null;
  size?: number;
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

function resolveSelectedRemoteUserId(settings: AppSettings): string | null {
  const selectedAccountId = normalizeOptionalText(settings.us1Slot?.selectedAccountId);
  const remoteUserIdFromAccountId =
    selectedAccountId !== null ? extractUs1RemoteIdentityIdFromAccountId(selectedAccountId) : null;

  return remoteUserIdFromAccountId ?? normalizeOptionalText(settings.us1Slot?.selectedRemoteUserId);
}

function buildRemoteUserFromRemoteAccount(
  account: Account | null | undefined
): RemoteUserIdentity | null {
  const remoteState = account?.remoteEmail;
  const remoteUserId = normalizeOptionalText(remoteState?.remoteUserId);
  const email = normalizeEmail(account?.email ?? remoteUserId ?? "");
  if (remoteState === undefined || remoteUserId === null || email === "") {
    return null;
  }

  return {
    remoteUserId,
    email,
    ...(typeof account?.nickname === "string" ? { nickname: account.nickname } : {}),
    ...(typeof account?.avatar === "string" ? { avatar: account.avatar } : {}),
    ...(typeof account?.avatarPath === "string" ? { avatarPath: account.avatarPath } : {}),
    handshakeState: remoteState.handshakeState,
    profileRevision: remoteState.profileRevision,
    linkedMailAccountId: remoteState.linkedLocalMailAccountId,
    ...(remoteState.inviteMessageId !== undefined
      ? { inviteMessageId: remoteState.inviteMessageId ?? null }
      : {}),
    ...(remoteState.acceptMessageId !== undefined
      ? { acceptMessageId: remoteState.acceptMessageId ?? null }
      : {}),
    ...(remoteState.threadMessageId !== undefined
      ? { threadMessageId: remoteState.threadMessageId ?? null }
      : {}),
    ...(remoteState.lastTransportMessageId !== undefined
      ? { lastTransportMessageId: remoteState.lastTransportMessageId ?? null }
      : {}),
    ...(remoteState.lastSyncAt !== undefined ? { lastSyncAt: remoteState.lastSyncAt } : {}),
    ...(remoteState.lastError !== undefined ? { lastError: remoteState.lastError ?? null } : {}),
    ...(remoteState.sessionAlias !== undefined
      ? { sessionAlias: remoteState.sessionAlias ?? null }
      : {}),
  };
}

function buildLocalMessageId(prefix: string, token: string, now: number): string {
  const normalizedToken = token
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${prefix}:${normalizedToken !== "" ? normalizedToken : "us1"}:${now}`;
}

function buildSyntheticTransportMessageId(localMessageId: string): string {
  return `synthetic:${localMessageId}`;
}

function buildSessionId(remoteUserId: string, threadSeed: string | null, now: number): string {
  const seed = normalizeOptionalText(threadSeed) ?? `${remoteUserId}:${now}`;
  return `us1-${hashString(`${remoteUserId}:${seed}:${now}`).slice(0, 16)}`;
}

function normalizeSessionMode(value: unknown): Us1SessionMode | null {
  return value === "new" || value === "reply" ? value : null;
}

function normalizeSessionOpenHint(value: unknown): Us1SessionOpenHint | null {
  return value === "auto_if_idle" || value === "list_only" ? value : null;
}

function parseHeaderValue(headerLines: string[], headerName: string): string | null {
  const normalizedHeaderName = headerName.toLowerCase();
  for (const line of headerLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    if (key !== normalizedHeaderName) {
      continue;
    }
    return normalizeOptionalText(line.slice(separatorIndex + 1));
  }
  return null;
}

function getAvatarExtension(
  filename: string | null,
  contentType: string | null,
  fallback = ".png"
): string {
  const fromFilename = filename !== null ? extname(filename).toLowerCase() : "";
  if (fromFilename !== "") {
    return fromFilename;
  }

  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/svg+xml") return ".svg";
  return fallback;
}

function getAvatarMimeType(filename: string | null, contentType: string | null): string {
  if (contentType !== null && contentType.trim() !== "") {
    return contentType;
  }

  const extension = getAvatarExtension(filename, null, ".png");
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "image/png";
}

function buildImageDataUrl(contentType: string, content: Buffer): string {
  return `data:${contentType};base64,${content.toString("base64")}`;
}

function findHandshakeAvatarAttachment(
  attachments: MailTransportParsedAttachment[],
  avatarAttachmentName: string | null
): MailTransportParsedAttachment | null {
  if (avatarAttachmentName !== null) {
    const matched = attachments.find(
      (attachment) =>
        normalizeOptionalText(attachment.filename)?.toLowerCase() ===
        avatarAttachmentName.toLowerCase()
    );
    if (matched !== undefined) {
      return matched;
    }
  }

  return (
    attachments.find((attachment) => {
      const contentType = normalizeOptionalText(attachment.contentType);
      return contentType?.startsWith("image/") === true;
    }) ?? null
  );
}

function extractJsonBlock(text: string, startMarker: string, endMarker: string): string | null {
  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escapedStart}\\s*([\\s\\S]+?)\\s*${escapedEnd}`));
  return match?.[1] ?? null;
}

function stripJsonBlock(text: string, startMarker: string, endMarker: string): string {
  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizeText(
    text.replace(new RegExp(`\\s*${escapedStart}[\\s\\S]+?${escapedEnd}\\s*`, "g"), "\n")
  );
}

function extractHandshakeEnvelope(text: string): HandshakeEnvelope | null {
  const payload = extractJsonBlock(text, HANDSHAKE_PAYLOAD_START, HANDSHAKE_PAYLOAD_END);
  if (payload === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<HandshakeEnvelope> | null;
    if (
      parsed?.protocol !== HANDSHAKE_PROTOCOL ||
      parsed.version !== HANDSHAKE_VERSION ||
      (parsed.messageType !== "invite" &&
        parsed.messageType !== "accept" &&
        parsed.messageType !== "reject" &&
        parsed.messageType !== "profile")
    ) {
      return null;
    }

    const profile = normalizeMessageProfile(parsed.profile);
    if (profile === null) {
      return null;
    }

    return {
      protocol: HANDSHAKE_PROTOCOL,
      version: HANDSHAKE_VERSION,
      messageType: parsed.messageType,
      inviteId: normalizeOptionalText(parsed.inviteId) ?? `invite_${Date.now()}`,
      sentAt:
        typeof parsed.sentAt === "number" && Number.isFinite(parsed.sentAt) && parsed.sentAt >= 0
          ? Math.trunc(parsed.sentAt)
          : Date.now(),
      profile,
    };
  } catch {
    return null;
  }
}

function normalizeMessageProfile(profile: unknown): MessageProfile | null {
  if (profile === null || profile === undefined || typeof profile !== "object") {
    return null;
  }

  const source = profile as Record<string, unknown>;
  const email = normalizeEmail(source["email"] ?? source["remoteUserId"]);
  if (email === "") {
    return null;
  }

  return {
    remoteUserId: normalizeEmail(source["remoteUserId"] ?? email),
    email,
    nickname: normalizeOptionalText(source["nickname"]) ?? email,
    avatar: normalizeOptionalText(source["avatar"]) ?? "",
    avatarAttachmentName: normalizeOptionalText(source["avatarAttachmentName"]),
    profileRevision:
      typeof source["profileRevision"] === "number" &&
      Number.isFinite(source["profileRevision"]) &&
      source["profileRevision"] >= 1
        ? Math.trunc(source["profileRevision"])
        : 1,
  };
}

function normalizeConversationSession(
  session: unknown,
  fallbackLocalSessionId: string | null,
  fallbackSentAt: number
): ConversationSessionDescriptor | null {
  const legacySessionId = normalizeOptionalText(fallbackLocalSessionId);
  if (session === null || session === undefined) {
    if (legacySessionId === null) {
      return null;
    }
    return {
      id: legacySessionId,
      mode: "reply",
      title: null,
      createdAt: fallbackSentAt,
      openHint: "list_only",
    };
  }

  if (typeof session !== "object") {
    return legacySessionId === null
      ? null
      : {
          id: legacySessionId,
          mode: "reply",
          title: null,
          createdAt: fallbackSentAt,
          openHint: "list_only",
        };
  }

  const source = session as Record<string, unknown>;
  const id = normalizeOptionalText(source["id"]) ?? legacySessionId;
  if (id === null) {
    return null;
  }

  return {
    id,
    mode: normalizeSessionMode(source["mode"]) ?? "reply",
    title: normalizeOptionalText(source["title"]),
    createdAt:
      typeof source["createdAt"] === "number" &&
      Number.isFinite(source["createdAt"]) &&
      source["createdAt"] >= 0
        ? Math.trunc(source["createdAt"])
        : fallbackSentAt,
    openHint: normalizeSessionOpenHint(source["openHint"]) ?? "list_only",
  };
}

function normalizeConversationThread(thread: unknown): ConversationThreadDescriptor | null {
  if (thread === null || thread === undefined || typeof thread !== "object") {
    return null;
  }

  const source = thread as Record<string, unknown>;
  return {
    threadRootMessageId: normalizeOptionalText(source["threadRootMessageId"]),
    replyToMessageId: normalizeOptionalText(source["replyToMessageId"]),
  };
}

function extractConversationEnvelope(text: string): ConversationEnvelope | null {
  const payload = extractJsonBlock(text, MESSAGE_PAYLOAD_START, MESSAGE_PAYLOAD_END);
  if (payload === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<ConversationEnvelope> | null;
    if (
      parsed?.protocol !== MESSAGE_PROTOCOL ||
      parsed.version !== MESSAGE_VERSION ||
      parsed.messageType !== MESSAGE_TYPE_CONVERSATION
    ) {
      return null;
    }

    const profile = normalizeMessageProfile(parsed.profile);
    if (profile === null) {
      return null;
    }

    return {
      protocol: MESSAGE_PROTOCOL,
      version: MESSAGE_VERSION,
      messageType: MESSAGE_TYPE_CONVERSATION,
      sentAt:
        typeof parsed.sentAt === "number" && Number.isFinite(parsed.sentAt) && parsed.sentAt >= 0
          ? Math.trunc(parsed.sentAt)
          : Date.now(),
      localSessionId: normalizeOptionalText(parsed.localSessionId),
      session: normalizeConversationSession(
        (parsed as Record<string, unknown>)["session"],
        normalizeOptionalText(parsed.localSessionId),
        typeof parsed.sentAt === "number" && Number.isFinite(parsed.sentAt) && parsed.sentAt >= 0
          ? Math.trunc(parsed.sentAt)
          : Date.now()
      ),
      thread: normalizeConversationThread((parsed as Record<string, unknown>)["thread"]),
      profile,
    };
  } catch {
    return null;
  }
}

function buildConversationPayload(text: string, envelope: ConversationEnvelope): string {
  const messageText = normalizeText(text);
  return [
    messageText !== "" ? messageText : OUTBOUND_ATTACHMENT_ONLY_TEXT,
    "",
    MESSAGE_PAYLOAD_START,
    JSON.stringify(envelope, null, 2),
    MESSAGE_PAYLOAD_END,
    "",
  ].join("\n");
}

function buildConversationSubject(text: string, attachmentCount: number): string {
  const preview = normalizeText(text).replace(/\n+/g, " ").slice(0, 72);
  if (preview !== "") {
    return `${SUBJECT_PREFIX}: ${preview}`;
  }
  if (attachmentCount > 0) {
    return `${SUBJECT_PREFIX}: ${attachmentCount} attachment`;
  }
  return SUBJECT_PREFIX;
}

function buildSessionTitle(text: string, attachmentCount: number): string | null {
  const preview = normalizeText(text).replace(/\n+/g, " ").slice(0, 48);
  if (preview !== "") {
    return preview;
  }
  if (attachmentCount > 0) {
    return `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`;
  }
  return null;
}

function buildConversationAuthor(
  remoteUser: Pick<RemoteUserIdentity, "nickname" | "email">
): string {
  return normalizeOptionalText(remoteUser.nickname) ?? remoteUser.email;
}

function buildConversationTitle(
  remoteUser: Pick<RemoteUserIdentity, "nickname" | "email">,
  sessionTitle?: string | null
): string {
  const author = buildConversationAuthor(remoteUser);
  const normalizedSessionTitle = normalizeOptionalText(sessionTitle);
  return normalizedSessionTitle === null ? author : `${author} / ${normalizedSessionTitle}`;
}

function buildArchiveMessageId(conversationId: string, domId: string): string {
  return hashString(`${conversationId}-${domId}`);
}

function toDisplayText(rawText: string, attachmentCount: number, fallback: string): string {
  const stripped = stripJsonBlock(rawText, MESSAGE_PAYLOAD_START, MESSAGE_PAYLOAD_END);
  if (stripped !== "") {
    return stripped;
  }
  return attachmentCount > 0 ? fallback : "";
}

function sortRemoteUsers(remoteUsers: RemoteUserIdentity[]): RemoteUserIdentity[] {
  const rank: Record<RemoteUserIdentity["handshakeState"], number> = {
    active: 0,
    handshake_pending: 1,
    invite_sent: 2,
    rejected: 3,
    error: 4,
  };

  return [...remoteUsers].sort((left, right) => {
    const stateDelta = rank[left.handshakeState] - rank[right.handshakeState];
    if (stateDelta !== 0) {
      return stateDelta;
    }
    return `${left.nickname ?? left.email}`.localeCompare(`${right.nickname ?? right.email}`, "tr");
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : String(error);
}

async function loadPersistedSettings(): Promise<AppSettings | null> {
  const settingsModule = await import("./settings-manager.ts");
  return await settingsModule.loadSettings();
}

async function persistSettingsToDisk(settings: AppSettings): Promise<boolean> {
  const settingsModule = await import("./settings-manager.ts");
  return await settingsModule.saveSettings(settings);
}

export class Us1ConversationService {
  private transport: MailTransportFacade;
  private now: () => number;
  private settingsStore: ConversationSettingsStore;
  private archiveFactory: ArchiveManagerFactory;

  constructor(
    options: {
      transport?: MailTransportFacade;
      now?: () => number;
      settingsStore?: Partial<ConversationSettingsStore>;
      archiveFactory?: ArchiveManagerFactory;
    } = {}
  ) {
    this.transport = options.transport ?? new MailTransportService();
    this.now = options.now ?? ((): number => Date.now());
    this.settingsStore = {
      loadSettings: options.settingsStore?.loadSettings ?? loadPersistedSettings,
      saveSettings: options.settingsStore?.saveSettings ?? persistSettingsToDisk,
    };
    this.archiveFactory =
      options.archiveFactory ??
      (async (accountId: string): Promise<ArchiveManagerLike> => {
        const { SQLiteArchiveManager: sqliteArchiveManagerCtor } =
          await import("./database/sqlite-archive.ts");
        return new sqliteArchiveManagerCtor(accountId);
      });
  }

  async sendMessage(params: Us1SendMessageParams): Promise<Us1SendMessageResult> {
    const settings = await this.loadNormalizedSettings();
    const binding = this.resolveActiveBinding(settings, true);
    if (binding === null) {
      return { success: false, error: "Active US1 binding is not available." };
    }

    const { remoteUser, account } = binding;
    const sidecar = new MailSidecarStoreManager(account.id);
    const text = normalizeText(params.text ?? "");
    const attachments = (params.attachments ?? []).filter(
      (attachment) => normalizeOptionalText(attachment.path) !== null
    );

    if (text === "" && attachments.length === 0) {
      return { success: false, error: "US1 message content is empty." };
    }

    const requestedSessionId = normalizeOptionalText(params.localSessionId);
    const latestMapping =
      requestedSessionId !== null
        ? sidecar.getSessionMapping(remoteUser.remoteUserId, requestedSessionId)
        : sidecar.getLatestSessionMapping(remoteUser.remoteUserId);
    const isNewSession = latestMapping === null;
    const localSessionId =
      requestedSessionId ??
      latestMapping?.localSessionId ??
      buildSessionId(remoteUser.remoteUserId, latestMapping?.threadMessageId ?? null, this.now());
    const sessionTitle = isNewSession ? buildSessionTitle(text, attachments.length) : null;
    const sessionMode: Us1SessionMode = isNewSession ? "new" : "reply";
    const sessionOpenHint: Us1SessionOpenHint = isNewSession ? "auto_if_idle" : "list_only";
    const localProfile = this.buildLocalProfile(settings, account);
    const localMessageId = buildLocalMessageId("us1-out", remoteUser.remoteUserId, this.now());
    const threadMessageId =
      latestMapping?.threadMessageId ?? normalizeOptionalText(remoteUser.threadMessageId);
    const inReplyTo =
      latestMapping?.lastMessageId ?? normalizeOptionalText(remoteUser.lastTransportMessageId);

    try {
      const transportResult = await this.transport.sendMail(account, {
        localMessageId,
        remoteUserId: remoteUser.remoteUserId,
        localSessionId,
        threadMessageId,
        to: remoteUser.email,
        subject: buildConversationSubject(text, attachments.length),
        text: buildConversationPayload(text, {
          protocol: MESSAGE_PROTOCOL,
          version: MESSAGE_VERSION,
          messageType: MESSAGE_TYPE_CONVERSATION,
          sentAt: this.now(),
          localSessionId,
          session: {
            id: localSessionId,
            mode: sessionMode,
            title: sessionTitle,
            createdAt: this.now(),
            openHint: sessionOpenHint,
          },
          thread: {
            threadRootMessageId: threadMessageId,
            replyToMessageId: inReplyTo,
          },
          profile: localProfile,
        }),
        inReplyTo,
        ...(threadMessageId !== null || inReplyTo !== null
          ? {
              references: [threadMessageId, inReplyTo].filter(
                (value): value is string => normalizeOptionalText(value) !== null
              ),
            }
          : {}),
        headers: {
          "X-Hayalet-Ev-Protocol": MESSAGE_PROTOCOL,
          "X-Hayalet-Ev-Message-Type": MESSAGE_TYPE_CONVERSATION,
          "X-Hayalet-Ev-Remote-User-Id": remoteUser.remoteUserId,
          "X-Hayalet-Ev-Session-Id": localSessionId,
          "X-Hayalet-Ev-Session-Mode": sessionMode,
          "X-Hayalet-Ev-Local-Session-Id": localSessionId,
          "X-Hayalet-Ev-Profile-Revision": String(localProfile.profileRevision),
        },
        attachments: attachments.map((attachment) => ({
          path: attachment.path,
          filename: normalizeOptionalText(attachment.name) ?? basename(attachment.path),
          ...(normalizeOptionalText(attachment.mimeType) !== null
            ? { contentType: attachment.mimeType }
            : {}),
        })),
      });

      const archiveContext = await this.prepareArchiveContext(
        remoteUser,
        localSessionId,
        isNewSession ? buildConversationTitle(remoteUser, sessionTitle) : null
      );
      const projectedMessage = await this.appendArchiveMessage(archiveContext, {
        role: "user",
        author: buildConversationAuthor(localProfile),
        text: text !== "" ? text : OUTBOUND_ATTACHMENT_ONLY_TEXT,
        domId: localMessageId,
      });
      const attachmentRefs = await this.saveOutboundAttachments(
        archiveContext.manager,
        projectedMessage.conversationId,
        projectedMessage.messageId,
        attachments
      );

      sidecar.upsertSessionMapping({
        remoteUserId: remoteUser.remoteUserId,
        localSessionId,
        threadMessageId:
          transportResult.threadMessageId ?? threadMessageId ?? transportResult.transportMessageId,
        lastMessageId: transportResult.transportMessageId,
      });
      sidecar.upsertMessageMeta({
        transportMessageId: transportResult.transportMessageId,
        localMessageId,
        deliveryState: transportResult.deliveryState,
        headersHash: transportResult.headersHash,
        metadata: {
          direction: "outbound",
          remoteUserId: remoteUser.remoteUserId,
          localSessionId,
          conversationId: projectedMessage.conversationId,
          webUrl: archiveContext.webUrl,
          archiveMessageId: projectedMessage.messageId,
          attachments: attachmentRefs,
        },
      });

      this.patchRemoteUserTransportState(settings, remoteUser.remoteUserId, {
        threadMessageId:
          transportResult.threadMessageId ?? threadMessageId ?? transportResult.transportMessageId,
        lastTransportMessageId: transportResult.transportMessageId,
        lastSyncAt: this.now(),
        lastError: null,
      });
      await this.persistSettings(settings);

      return {
        success: true,
        remoteUserId: remoteUser.remoteUserId,
        localSessionId,
        conversationId: projectedMessage.conversationId,
        transportMessageId: transportResult.transportMessageId,
        archiveMessageId: projectedMessage.messageId,
        deliveryState: transportResult.deliveryState,
        attachmentCount: attachmentRefs.length,
      };
    } catch (error) {
      this.patchRemoteUserTransportState(settings, remoteUser.remoteUserId, {
        lastSyncAt: this.now(),
        lastError: getErrorMessage(error),
      });
      await this.persistSettings(settings);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async syncMessages(params: Us1SyncMessagesParams = {}): Promise<Us1SyncMessagesResult> {
    const settings = await this.loadNormalizedSettings();
    const binding = this.resolveActiveBinding(settings, true);
    if (binding === null) {
      return {
        success: true,
        localSessionId: null,
        conversationId: null,
        fetchedCount: 0,
        processedCount: 0,
        duplicateCount: 0,
        projectedCount: 0,
        skippedCount: 0,
        unresolvedSessionCount: 0,
        roomPackages: [],
      };
    }

    const { remoteUser: activeRemoteUser, account } = binding;
    const sidecar = new MailSidecarStoreManager(account.id);

    try {
      const fetchResult = await this.transport.fetchInbox(account, {
        limit: typeof params.limit === "number" && params.limit > 0 ? Math.trunc(params.limit) : 20,
        includeAttachmentContent: true,
      });

      let projectedCount = 0;
      let skippedCount = 0;
      let unresolvedSessionCount = 0;
      let activeConversationId: string | null = null;
      let activeLocalSessionId: string | null = normalizeOptionalText(params.localSessionId);
      const roomPackages: Us1RoomPackageCandidate[] = [];
      const sessionEventsById = new Map<string, Us1SessionEvent>();

      this.applyFetchedHandshakeMessages(settings, account, fetchResult);

      for (const message of fetchResult.messages) {
        if (message.duplicate === true) {
          continue;
        }

        const protocolHeader = parseHeaderValue(
          message.parsed.headerLines,
          "X-Hayalet-Ev-Protocol"
        );
        if (protocolHeader === HANDSHAKE_PROTOCOL) {
          continue;
        }

        const messageEnvelope = extractConversationEnvelope(message.parsed.text);
        const remoteUserId = this.resolveRemoteUserId(
          messageEnvelope,
          message,
          activeRemoteUser.remoteUserId
        );
        const existingRemoteUser = this.findRemoteUser(settings, remoteUserId);
        if (remoteUserId === "" || existingRemoteUser?.handshakeState !== "active") {
          skippedCount += 1;
          continue;
        }

        const nextRemoteUser = this.upsertRemoteUser(settings, {
          remoteUserId,
          email: remoteUserId,
          nickname:
            messageEnvelope?.profile.nickname ?? existingRemoteUser.nickname ?? remoteUserId,
          avatar: messageEnvelope?.profile.avatar ?? existingRemoteUser.avatar ?? "",
          avatarPath: existingRemoteUser.avatarPath ?? "",
          handshakeState: "active",
          profileRevision:
            messageEnvelope?.profile.profileRevision ?? existingRemoteUser.profileRevision,
          linkedMailAccountId: existingRemoteUser.linkedMailAccountId,
          inviteMessageId: existingRemoteUser.inviteMessageId ?? null,
          acceptMessageId: existingRemoteUser.acceptMessageId ?? null,
          threadMessageId:
            normalizeOptionalText(message.threadMessageId) ??
            existingRemoteUser.threadMessageId ??
            normalizeOptionalText(message.transportMessageId),
          lastTransportMessageId:
            normalizeOptionalText(message.transportMessageId) ??
            existingRemoteUser.lastTransportMessageId ??
            null,
          lastSyncAt: this.now(),
          lastError: null,
        });

        const sessionDescriptor = messageEnvelope?.session ?? null;
        const sessionTitle = normalizeOptionalText(sessionDescriptor?.title);
        const sessionIdFromEnvelope = normalizeOptionalText(sessionDescriptor?.id);
        const explicitSessionId =
          sessionIdFromEnvelope ?? normalizeOptionalText(messageEnvelope?.localSessionId);
        let localSessionId =
          sessionIdFromEnvelope ??
          normalizeOptionalText(message.localSessionId) ??
          normalizeOptionalText(messageEnvelope?.localSessionId) ??
          sidecar.getLatestSessionMapping(remoteUserId)?.localSessionId ??
          null;
        const existingSessionMapping =
          localSessionId !== null ? sidecar.getSessionMapping(remoteUserId, localSessionId) : null;
        if (localSessionId === null) {
          localSessionId = buildSessionId(
            remoteUserId,
            normalizeOptionalText(message.threadMessageId) ??
              normalizeOptionalText(message.transportMessageId),
            this.now()
          );
          unresolvedSessionCount += 1;
        }

        const isNewSession = existingSessionMapping === null;
        const archiveTitle =
          isNewSession === true
            ? buildConversationTitle(
                nextRemoteUser,
                sessionTitle ??
                  buildSessionTitle(
                    toDisplayText(
                      message.parsed.text,
                      message.parsed.attachments.length,
                      INBOUND_ATTACHMENT_ONLY_TEXT
                    ),
                    message.parsed.attachments.length
                  )
              )
            : null;

        // eslint-disable-next-line no-await-in-loop -- NOTE: per-message archive work is sequential.
        const archiveContext = await this.prepareArchiveContext(
          nextRemoteUser,
          localSessionId,
          archiveTitle
        );
        const transportMessageId =
          normalizeOptionalText(message.transportMessageId) ??
          buildSyntheticTransportMessageId(message.localMessageId);
        const displayText = toDisplayText(
          message.parsed.text,
          message.parsed.attachments.length,
          INBOUND_ATTACHMENT_ONLY_TEXT
        );
        // eslint-disable-next-line no-await-in-loop -- NOTE: projection order must be preserved.
        const projectedMessage = await this.appendArchiveMessage(archiveContext, {
          role: "assistant",
          author: buildConversationAuthor(nextRemoteUser),
          text: displayText,
          domId: transportMessageId,
        });
        // eslint-disable-next-line no-await-in-loop -- NOTE: attachment persistence is sequential per message.
        const inboundAttachments = await this.saveInboundAttachments(
          archiveContext.manager,
          projectedMessage.conversationId,
          projectedMessage.messageId,
          nextRemoteUser.remoteUserId,
          localSessionId,
          message.parsed.attachments
        );

        sidecar.upsertSessionMapping({
          remoteUserId,
          localSessionId,
          threadMessageId:
            normalizeOptionalText(message.threadMessageId) ??
            nextRemoteUser.threadMessageId ??
            transportMessageId,
          lastMessageId: transportMessageId,
        });
        sidecar.upsertMessageMeta({
          transportMessageId,
          localMessageId: message.localMessageId,
          deliveryState: message.deliveryState,
          headersHash: message.headersHash,
          metadata: {
            direction: "inbound",
            remoteUserId,
            localSessionId,
            conversationId: projectedMessage.conversationId,
            webUrl: archiveContext.webUrl,
            archiveMessageId: projectedMessage.messageId,
            attachments: inboundAttachments.attachmentRefs,
            missingAttachmentCount: inboundAttachments.missingAttachmentCount,
          },
        });

        projectedCount += 1;
        const sessionEvent = sessionEventsById.get(localSessionId);
        sessionEventsById.set(localSessionId, {
          remoteUserId,
          localSessionId,
          conversationId: projectedMessage.conversationId,
          sessionTitle,
          mode: sessionDescriptor?.mode ?? (isNewSession ? "new" : "reply"),
          openHint: sessionDescriptor?.openHint ?? (isNewSession ? "auto_if_idle" : "list_only"),
          createdAt: sessionDescriptor?.createdAt ?? messageEnvelope?.sentAt,
          sentAt: messageEnvelope?.sentAt ?? message.parsed.receivedAt,
          isNewSession:
            sessionEvent?.isNewSession === true ||
            (isNewSession === true && explicitSessionId !== null),
        });
        if (remoteUserId === activeRemoteUser.remoteUserId) {
          activeConversationId = projectedMessage.conversationId;
          activeLocalSessionId = localSessionId;
          roomPackages.push(...inboundAttachments.roomPackages);
        }
      }

      if (activeConversationId === null) {
        const latestMapping = sidecar.getLatestSessionMapping(activeRemoteUser.remoteUserId);
        const fallbackSessionId = activeLocalSessionId ?? latestMapping?.localSessionId ?? null;
        if (fallbackSessionId !== null) {
          const archiveContext = await this.prepareArchiveContext(
            activeRemoteUser,
            fallbackSessionId
          );
          activeConversationId = archiveContext.conversationId;
          activeLocalSessionId = fallbackSessionId;
        }
      }

      await this.persistSettings(settings);

      return {
        success: true,
        remoteUserId: activeRemoteUser.remoteUserId,
        localSessionId: activeLocalSessionId,
        conversationId: activeConversationId,
        fetchedCount: fetchResult.fetchedCount,
        processedCount: fetchResult.processedCount,
        duplicateCount: fetchResult.duplicateCount,
        projectedCount,
        skippedCount,
        unresolvedSessionCount,
        roomPackages,
        sessionEvents: Array.from(sessionEventsById.values()),
      };
    } catch (error) {
      this.patchRemoteUserTransportState(settings, activeRemoteUser.remoteUserId, {
        lastSyncAt: this.now(),
        lastError: getErrorMessage(error),
      });
      await this.persistSettings(settings);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  private async loadNormalizedSettings(): Promise<AppSettings> {
    return normalizeSettings((await this.settingsStore.loadSettings()) ?? {});
  }

  private async persistSettings(settings: AppSettings): Promise<void> {
    const saved = await this.settingsStore.saveSettings(normalizeSettings(settings));
    if (saved !== true) {
      throw new Error("Failed to persist US1 conversation settings.");
    }
  }

  private resolveActiveBinding(
    settings: AppSettings,
    requireConnected: boolean
  ): ResolvedBinding | null {
    const remoteAccounts = getRemoteEmailAccounts(settings.accounts);
    const selectedAccountId = normalizeOptionalText(settings.us1Slot?.selectedAccountId);
    const selectedRemoteUserId = resolveSelectedRemoteUserId(settings);
    const integrations = settings.integrations ?? {};

    const remoteAccount =
      (selectedAccountId !== null
        ? remoteAccounts.find(
            (candidate) =>
              candidate.id === selectedAccountId &&
              candidate.remoteEmail?.handshakeState === "active"
          )
        : null) ??
      (selectedRemoteUserId !== null
        ? remoteAccounts.find(
            (candidate) =>
              normalizeOptionalText(candidate.remoteEmail?.remoteUserId) === selectedRemoteUserId &&
              candidate.remoteEmail?.handshakeState === "active"
          )
        : null) ??
      null;

    const remoteUserFromAccount = buildRemoteUserFromRemoteAccount(remoteAccount);
    if (remoteUserFromAccount !== null) {
      const account =
        integrations.mailTransport?.accounts.find(
          (candidate) => candidate.id === remoteUserFromAccount.linkedMailAccountId
        ) ?? null;
      if (account !== null && account.enabled !== false) {
        if (
          requireConnected === true &&
          (settings.us1Slot?.connectionState !== "connected" ||
            account.connectionState !== "connected")
        ) {
          return null;
        }

        return { remoteUser: remoteUserFromAccount, account };
      }
    }

    if (selectedRemoteUserId === null) {
      return null;
    }

    const remoteUser =
      (settings.remoteUsers ?? []).find(
        (candidate) =>
          candidate.remoteUserId === selectedRemoteUserId && candidate.handshakeState === "active"
      ) ?? null;
    if (remoteUser === null) {
      return null;
    }

    const account =
      integrations.mailTransport?.accounts.find(
        (candidate) => candidate.id === remoteUser.linkedMailAccountId
      ) ?? null;
    if (account === null || account.enabled === false) {
      return null;
    }

    if (
      requireConnected === true &&
      (settings.us1Slot?.connectionState !== "connected" || account.connectionState !== "connected")
    ) {
      return null;
    }

    return { remoteUser, account };
  }

  private findRemoteUser(settings: AppSettings, remoteUserId: string): RemoteUserIdentity | null {
    const remoteUserFromAccount = buildRemoteUserFromRemoteAccount(
      getRemoteEmailAccounts(settings.accounts).find(
        (account) => normalizeOptionalText(account.remoteEmail?.remoteUserId) === remoteUserId
      ) ?? null
    );
    if (remoteUserFromAccount !== null) {
      return remoteUserFromAccount;
    }

    return (
      (settings.remoteUsers ?? []).find((remoteUser) => remoteUser.remoteUserId === remoteUserId) ??
      null
    );
  }

  private buildLocalProfile(
    settings: AppSettings,
    account: MailTransportAccountConfig
  ): MessageProfile {
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
      remoteUserId: normalizeEmail(account.email),
      email: normalizeEmail(account.email),
      nickname,
      avatar,
      profileRevision: this.now(),
    };
  }

  private resolveHandshakeAvatar(
    profile: MessageProfile,
    attachments: MailTransportParsedAttachment[]
  ): string {
    if (
      profile.avatar.startsWith("https://") ||
      profile.avatar.startsWith("http://") ||
      profile.avatar.startsWith("data:")
    ) {
      return profile.avatar;
    }

    const attachment = findHandshakeAvatarAttachment(
      attachments,
      profile.avatarAttachmentName ?? null
    );
    if (attachment?.content === undefined) {
      return "";
    }

    return buildImageDataUrl(
      getAvatarMimeType(attachment.filename, normalizeOptionalText(attachment.contentType)),
      attachment.content
    );
  }

  private patchRemoteUserTransportState(
    settings: AppSettings,
    remoteUserId: string,
    patch: {
      threadMessageId?: string | null;
      lastTransportMessageId?: string | null;
      lastSyncAt?: number;
      lastError?: string | null;
    }
  ): void {
    const remoteUsers = settings.remoteUsers ?? [];
    const index = remoteUsers.findIndex((remoteUser) => remoteUser.remoteUserId === remoteUserId);
    if (index < 0) {
      return;
    }

    const current = remoteUsers[index];
    if (current === undefined) {
      return;
    }

    remoteUsers[index] = {
      ...current,
      ...(patch.threadMessageId !== undefined ? { threadMessageId: patch.threadMessageId } : {}),
      ...(patch.lastTransportMessageId !== undefined
        ? { lastTransportMessageId: patch.lastTransportMessageId }
        : {}),
      ...(patch.lastSyncAt !== undefined ? { lastSyncAt: patch.lastSyncAt } : {}),
      lastError: patch.lastError ?? null,
    };
    settings.remoteUsers = sortRemoteUsers(remoteUsers);
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
      existingRemoteUser?.handshakeState === "active" && candidate.handshakeState !== "active"
        ? "active"
        : candidate.handshakeState;
    const resolvedLastSyncAt = candidate.lastSyncAt ?? existingRemoteUser?.lastSyncAt;
    const fallbackRemoteUser = existingRemoteUser ?? candidate;
    const resolvedNickname =
      shouldApplyIncomingProfile === true
        ? (candidate.nickname ?? candidate.email)
        : (fallbackRemoteUser.nickname ?? candidate.nickname ?? candidate.email);
    const resolvedAvatar =
      shouldApplyIncomingProfile === true
        ? (candidate.avatar ?? "")
        : (fallbackRemoteUser.avatar ?? candidate.avatar ?? "");
    const resolvedProfileRevision =
      shouldApplyIncomingProfile === true
        ? candidate.profileRevision
        : fallbackRemoteUser.profileRevision;

    const nextRemoteUser: RemoteUserIdentity = {
      remoteUserId: candidate.remoteUserId,
      email: candidate.email,
      nickname: resolvedNickname,
      avatar: resolvedAvatar,
      avatarPath:
        normalizeOptionalText(candidate.avatarPath) ??
        normalizeOptionalText(existingRemoteUser?.avatarPath) ??
        "",
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

  private applyFetchedHandshakeMessages(
    settings: AppSettings,
    account: MailTransportAccountConfig,
    fetchResult: FetchInboxResult
  ): void {
    for (const message of fetchResult.messages) {
      if (message.duplicate) {
        continue;
      }

      const protocolHeader = parseHeaderValue(message.parsed.headerLines, "X-Hayalet-Ev-Protocol");
      if (protocolHeader !== HANDSHAKE_PROTOCOL) {
        continue;
      }

      const envelope = extractHandshakeEnvelope(message.parsed.text);
      if (envelope === null) {
        continue;
      }

      const existingRemoteUser = this.findRemoteUser(settings, envelope.profile.remoteUserId);
      const handshakeState =
        envelope.messageType === "accept"
          ? "active"
          : envelope.messageType === "reject"
            ? existingRemoteUser?.handshakeState === "active"
              ? "active"
              : "rejected"
            : existingRemoteUser?.handshakeState === "active"
              ? "active"
              : envelope.messageType === "invite"
                ? "handshake_pending"
                : (existingRemoteUser?.handshakeState ?? "handshake_pending");

      this.upsertRemoteUser(settings, {
        remoteUserId: envelope.profile.remoteUserId,
        email: envelope.profile.email,
        nickname: envelope.profile.nickname,
        avatar:
          envelope.messageType === "reject"
            ? (existingRemoteUser?.avatar ?? "")
            : this.resolveHandshakeAvatar(envelope.profile, message.parsed.attachments),
        avatarPath: existingRemoteUser?.avatarPath ?? "",
        handshakeState,
        profileRevision: envelope.profile.profileRevision,
        linkedMailAccountId: existingRemoteUser?.linkedMailAccountId ?? account.id,
        inviteMessageId:
          envelope.messageType === "invite"
            ? message.transportMessageId
            : (existingRemoteUser?.inviteMessageId ?? null),
        acceptMessageId:
          envelope.messageType === "accept"
            ? message.transportMessageId
            : (existingRemoteUser?.acceptMessageId ?? null),
        threadMessageId: existingRemoteUser?.threadMessageId ?? message.transportMessageId ?? null,
        lastTransportMessageId: message.transportMessageId,
        lastSyncAt: this.now(),
        lastError: null,
      });
    }
  }

  private resolveRemoteUserId(
    messageEnvelope: ConversationEnvelope | null,
    message: FetchInboxResult["messages"][number],
    activeRemoteUserId: string
  ): string {
    const candidates = [
      normalizeEmail(messageEnvelope?.profile.email),
      normalizeEmail(messageEnvelope?.profile.remoteUserId),
      normalizeEmail(message.remoteUserId),
      normalizeEmail(message.parsed.from.find((entry) => entry.address !== null)?.address),
    ];
    const resolved = candidates.find((value) => value !== "");
    return resolved ?? activeRemoteUserId;
  }

  private async prepareArchiveContext(
    remoteUser: Pick<RemoteUserIdentity, "remoteUserId" | "nickname" | "email">,
    localSessionId: string,
    title?: string | null
  ): Promise<ArchiveContext> {
    const archiveAccountId = buildRemoteEmailAccountId(remoteUser.remoteUserId);
    if (archiveAccountId === "") {
      throw new Error("US1 archive account id could not be resolved.");
    }

    const webUrl = buildUs1SyntheticSessionUri(remoteUser.remoteUserId, localSessionId);
    if (webUrl === "") {
      throw new Error("US1 synthetic session uri could not be resolved.");
    }

    const manager = await this.archiveFactory(archiveAccountId);
    const metadataResult = await manager.upsertConversationMetadata({
      webUrl,
      provider: "us1",
      title,
    });
    if (metadataResult.success !== true || metadataResult.data === undefined) {
      throw new Error(metadataResult.error ?? "US1 archive conversation metadata sync failed.");
    }

    return {
      manager,
      archiveAccountId,
      webUrl,
      conversationId: metadataResult.data.conversationId,
    };
  }

  private async appendArchiveMessage(
    archiveContext: ArchiveContext,
    message: {
      role: "user" | "assistant";
      author: string;
      text: string;
      domId: string;
    }
  ): Promise<{ conversationId: string; messageId: string }> {
    const currentMessages = await archiveContext.manager.getMessages(archiveContext.conversationId);
    const nextIndex = Array.isArray(currentMessages.data) ? currentMessages.data.length : 0;
    const messageId = buildArchiveMessageId(archiveContext.conversationId, message.domId);

    const syncResult = await archiveContext.manager.syncMessages({
      accountId: archiveContext.archiveAccountId,
      provider: "us1",
      webUrl: archiveContext.webUrl,
      messages: [
        {
          role: message.role,
          text: message.text,
          author: message.author,
          index: nextIndex,
          domIndex: nextIndex,
          domId: message.domId,
        },
      ],
    });

    if (syncResult.success !== true) {
      throw new Error(syncResult.error ?? "US1 archive message projection failed.");
    }

    return {
      conversationId: syncResult.conversationId ?? archiveContext.conversationId,
      messageId,
    };
  }

  private async saveOutboundAttachments(
    manager: ArchiveManagerLike,
    conversationId: string,
    messageId: string,
    attachments: NonNullable<Us1SendMessageParams["attachments"]>
  ): Promise<AttachmentArchiveRef[]> {
    const attachmentRefs: AttachmentArchiveRef[] = [];

    for (const attachment of attachments) {
      const filePath = normalizeOptionalText(attachment.path);
      if (filePath === null) {
        continue;
      }

      const originalName = normalizeOptionalText(attachment.name) ?? basename(filePath);
      // eslint-disable-next-line no-await-in-loop -- NOTE: attachment save order is sequential.
      const saveResult = await manager.saveAttachment(
        conversationId,
        messageId,
        filePath,
        originalName,
        normalizeOptionalText(attachment.mimeType) ?? undefined
      );
      if (saveResult.success !== true || saveResult.data === undefined) {
        continue;
      }

      attachmentRefs.push({
        attachmentId: saveResult.data.attachmentId,
        originalName,
        storedPath: saveResult.data.storedPath,
        mimeType: normalizeOptionalText(attachment.mimeType),
      });
    }

    return attachmentRefs;
  }

  private async saveInboundAttachments(
    manager: ArchiveManagerLike,
    conversationId: string,
    messageId: string,
    remoteUserId: string,
    localSessionId: string,
    attachments: MailTransportParsedAttachment[]
  ): Promise<{
    attachmentRefs: AttachmentArchiveRef[];
    roomPackages: Us1RoomPackageCandidate[];
    missingAttachmentCount: number;
  }> {
    const attachmentRefs: AttachmentArchiveRef[] = [];
    const roomPackages: Us1RoomPackageCandidate[] = [];
    let missingAttachmentCount = 0;

    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      if (attachment === undefined) {
        continue;
      }
      const originalName =
        normalizeOptionalText(attachment.filename) ??
        `attachment-${String(index + 1).padStart(2, "0")}`;
      if (!Buffer.isBuffer(attachment.content)) {
        missingAttachmentCount += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- NOTE: attachment content is persisted sequentially.
      const saveResult = await manager.saveAttachmentContent(
        conversationId,
        messageId,
        attachment.content,
        originalName,
        normalizeOptionalText(attachment.contentType) ?? undefined
      );
      if (saveResult.success !== true || saveResult.data === undefined) {
        continue;
      }

      const attachmentRef: AttachmentArchiveRef = {
        attachmentId: saveResult.data.attachmentId,
        originalName,
        storedPath: saveResult.data.storedPath,
        mimeType: normalizeOptionalText(attachment.contentType),
        size: attachment.size,
      };
      attachmentRefs.push(attachmentRef);

      if (this.isRoomPackageAttachment(originalName, attachment.content)) {
        roomPackages.push({
          remoteUserId,
          localSessionId,
          conversationId,
          messageId,
          attachmentId: saveResult.data.attachmentId,
          originalName,
          storedPath: saveResult.data.storedPath,
          mimeType: normalizeOptionalText(attachment.contentType),
          size: attachment.size,
        });
      }
    }

    return { attachmentRefs, roomPackages, missingAttachmentCount };
  }

  private isRoomPackageAttachment(filename: string, content: Buffer): boolean {
    const normalizedFilename = filename.trim().toLowerCase();
    if (normalizedFilename.endsWith(ROOM_BUNDLE_SUFFIX)) {
      return true;
    }

    if (!normalizedFilename.endsWith(".json")) {
      return false;
    }

    try {
      const parsed: unknown = JSON.parse(content.toString("utf-8"));
      if (parsed === null || typeof parsed !== "object") {
        return false;
      }
      const record = parsed as { manifest?: { id?: unknown }; files?: unknown };
      const manifestId = record.manifest?.id;
      if (typeof manifestId !== "string" || manifestId.trim() === "") {
        return false;
      }
      return record.files !== null && typeof record.files === "object";
    } catch {
      return false;
    }
  }
}

export const us1ConversationService = new Us1ConversationService();
