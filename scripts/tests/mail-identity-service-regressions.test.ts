import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { closeDatabaseForAccount } from "../../electron/database/sqlite-manager.ts";
import { MailIdentityService } from "../../electron/mail-identity-service.ts";
import type {
  FetchInboxResult,
  MailTransportParsedAttachment,
  ParsedTransportMessage,
  SendMailRequest,
} from "../../electron/mail-transport/index.ts";
import { initPaths, Paths } from "../../electron/paths.ts";
import { createDefaultSettings } from "../../src/types/settings-defaults.ts";
import { buildRemoteEmailAccountId } from "../../src/types/archive.ts";
import type { AppSettings, RemoteUserIdentity } from "../../src/types/settings.ts";
import { normalizeSettings } from "../../src/js/modules/settings/settings-schema.ts";

const HANDSHAKE_PROTOCOL = "hayalet-ev-us1-handshake";
const HANDSHAKE_VERSION = 1;
const PAYLOAD_START = "--- HAYALET_EV_US1_PAYLOAD ---";
const PAYLOAD_END = "--- /HAYALET_EV_US1_PAYLOAD ---";
const FIXED_NOW = 1700000000000;

type HandshakeMessageType = "invite" | "accept" | "reject" | "profile";

initPaths(join(process.cwd(), "electron"));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSettingsStore(initial?: AppSettings) {
  let current = normalizeSettings(initial ?? createDefaultSettings());

  return {
    loadSettings(): AppSettings {
      return clone(current);
    },
    saveSettings(next: AppSettings): boolean {
      current = normalizeSettings(clone(next));
      return true;
    },
    snapshot(): AppSettings {
      return clone(current);
    },
  };
}

function createParsedMessage(
  text: string,
  transportMessageId: string,
  attachments: MailTransportParsedAttachment[] = []
): ParsedTransportMessage {
  return {
    transportMessageId,
    inReplyTo: null,
    references: [],
    subject: "[Hayalet Ev] Handshake",
    text,
    html: null,
    headersHash: `headers:${transportMessageId}`,
    headerLines: [
      `X-Hayalet-Ev-Protocol: ${HANDSHAKE_PROTOCOL}`,
      "Content-Type: text/plain; charset=utf-8",
    ],
    from: [],
    to: [],
    cc: [],
    bcc: [],
    replyTo: [],
    attachments,
    receivedAt: FIXED_NOW,
    rawSize: text.length,
  };
}

function createHandshakePayload(options: {
  messageType: HandshakeMessageType;
  email: string;
  nickname?: string;
  profileRevision?: number;
  inviteId?: string;
  avatar?: string;
  avatarAttachmentName?: string | null;
}): string {
  return [
    "Hayalet Ev US1 handshake payload.",
    "",
    PAYLOAD_START,
    JSON.stringify(
      {
        protocol: HANDSHAKE_PROTOCOL,
        version: HANDSHAKE_VERSION,
        messageType: options.messageType,
        inviteId: options.inviteId ?? "invite-fixed",
        sentAt: FIXED_NOW,
        profile: {
          remoteUserId: options.email,
          email: options.email,
          nickname: options.nickname ?? options.email,
          avatar: options.avatar ?? "",
          ...(options.avatarAttachmentName !== undefined
            ? { avatarAttachmentName: options.avatarAttachmentName }
            : {}),
          profileRevision: options.profileRevision ?? FIXED_NOW,
        },
      },
      null,
      2
    ),
    PAYLOAD_END,
    "",
  ].join("\n");
}

function createFetchedHandshakeResult(options: {
  accountId: string;
  transportMessageId: string;
  messageType: HandshakeMessageType;
  email: string;
  nickname?: string;
  inviteId?: string;
  avatar?: string;
  avatarAttachmentName?: string | null;
  attachments?: MailTransportParsedAttachment[];
}): FetchInboxResult {
  const payload: Parameters<typeof createHandshakePayload>[0] = {
    messageType: options.messageType,
    email: options.email,
  };
  if (options.nickname !== undefined) payload.nickname = options.nickname;
  if (options.inviteId !== undefined) payload.inviteId = options.inviteId;
  if (options.avatar !== undefined) payload.avatar = options.avatar;
  if (options.avatarAttachmentName !== undefined) {
    payload.avatarAttachmentName = options.avatarAttachmentName;
  }

  const text = createHandshakePayload(payload);

  return {
    accountId: options.accountId,
    mailbox: "INBOX",
    cursor: "uid:1",
    fetchedCount: 1,
    processedCount: 1,
    duplicateCount: 0,
    messages: [
      {
        status: "processed",
        duplicate: false,
        accountId: options.accountId,
        mailbox: "INBOX",
        uid: 1,
        threadId: null,
        transportMessageId: options.transportMessageId,
        localMessageId: `local:${options.messageType}`,
        fingerprint: `fingerprint:${options.messageType}`,
        headersHash: `headers:${options.messageType}`,
        deliveryState: "received",
        remoteUserId: options.email,
        localSessionId: null,
        threadMessageId: options.transportMessageId,
        parsed: createParsedMessage(text, options.transportMessageId, options.attachments ?? []),
      },
    ],
  };
}

function extractHandshakeEnvelope(message: SendMailRequest): Record<string, unknown> {
  const text = typeof message.text === "string" ? message.text : "";
  const match = text.match(
    /--- HAYALET_EV_US1_PAYLOAD ---\s*([\s\S]+?)\s*--- \/HAYALET_EV_US1_PAYLOAD ---/
  );
  assert.ok(match?.[1] != null);
  return JSON.parse(match[1]) as Record<string, unknown>;
}

function cleanupRemoteAccount(remoteUserId: string): void {
  const accountId = buildRemoteEmailAccountId(remoteUserId);
  closeDatabaseForAccount(accountId);
  rmSync(Paths.getAccountDir(accountId), { recursive: true, force: true });
}

function createTransportStub() {
  const sentMessages: SendMailRequest[] = [];
  const fetchQueue: FetchInboxResult[] = [];

  return {
    sentMessages,
    enqueueFetch(result: FetchInboxResult): void {
      fetchQueue.push(result);
    },
    transport: {
      async probeAccount(account: { id: string }) {
        return {
          accountId: account.id,
          connectionState: "connected" as const,
          smtpVerified: true,
          imapVerified: true,
        };
      },
      async sendMail(account: { id: string }, message: SendMailRequest) {
        sentMessages.push(clone(message));
        const transportMessageId = message.messageId ?? `<${message.localMessageId}@example.test>`;
        const threadMessageId = message.threadMessageId ?? transportMessageId;
        const recipients = Array.isArray(message.to) ? message.to : [message.to];

        return {
          accountId: account.id,
          localMessageId: message.localMessageId,
          transportMessageId,
          deliveryState: "sent",
          headersHash: `hash:${message.localMessageId}`,
          accepted: recipients,
          rejected: [] as string[],
          pending: [] as string[],
          response: "250 ok",
          remoteUserId: message.remoteUserId ?? null,
          localSessionId: message.localSessionId ?? null,
          threadMessageId,
        };
      },
      async fetchInbox(account: { id: string }) {
        return (
          fetchQueue.shift() ?? {
            accountId: account.id,
            mailbox: "INBOX",
            cursor: null,
            fetchedCount: 0,
            processedCount: 0,
            duplicateCount: 0,
            messages: [],
          }
        );
      },
    },
  };
}

function createMailAccountDraft(email = "local@example.com") {
  return {
    providerType: "gmail" as const,
    email,
    enabled: true,
    authType: "password" as const,
    auth: {
      user: email,
      password: "app-password",
    },
  };
}

async function createConnectedServiceContext() {
  const store = createSettingsStore();
  const transportStub = createTransportStub();
  const service = new MailIdentityService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    settingsStore: {
      loadSettings: async () => await Promise.resolve(store.loadSettings()),
      saveSettings: async (settings) => await Promise.resolve(store.saveSettings(settings)),
    },
  });

  const saveResult = await service.upsertMailAccount(createMailAccountDraft(), { verifyAfterSave: false });
  assert.equal(saveResult.success, true);
  const accountId = store.snapshot().integrations?.mailTransport?.accounts[0]?.id;
  assert.ok(accountId != null);

  const verifyResult = await service.verifyMailAccount(accountId);
  assert.equal(verifyResult.success, true);

  return {
    service,
    store,
    transportStub,
    accountId,
  };
}
