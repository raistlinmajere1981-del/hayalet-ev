import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { MailSidecarStoreManager } from "../../electron/database/mail-sidecar-manager.ts";
import { closeMailSidecarDatabaseForAccount as closeMailSidecarDbForAccount } from "../../electron/database/mail-sidecar-sqlite.ts";
import { getLoggerCore } from "../../electron/logger/core/LoggerCore.ts";
import Database from "../../electron/native/better-sqlite3.ts";
import { initPaths, Paths } from "../../electron/paths.ts";
import { Us1ConversationService } from "../../electron/us1-conversation-service.ts";
import { hashString } from "../../electron/database/hash-utils.ts";
import { buildRemoteEmailAccountId } from "../../src/types/archive.ts";
import { createDefaultSettings } from "../../src/types/settings-defaults.ts";
import type { AppSettings, MailTransportAccountConfig } from "../../src/types/settings.ts";
import { normalizeSettings } from "../../src/js/modules/settings/settings-schema.ts";
import type { FetchInboxResult, SendMailRequest } from "../../electron/mail-transport/index.ts";

const FIXED_NOW = 1700000000000;
const MESSAGE_PROTOCOL = "hayalet-ev-us1-message";
const MESSAGE_PAYLOAD_START = "--- HAYALET_EV_US1_MESSAGE_PAYLOAD ---";
const MESSAGE_PAYLOAD_END = "--- /HAYALET_EV_US1_MESSAGE_PAYLOAD ---";

const electronDir = join(process.cwd(), "electron");
initPaths(electronDir);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSettingsStore(initial: AppSettings) {
  let current = normalizeSettings(initial);

  return {
    async loadSettings(): Promise<AppSettings> {
      return clone(current);
    },
    async saveSettings(next: AppSettings): Promise<boolean> {
      current = normalizeSettings(clone(next));
      return true;
    },
    snapshot(): AppSettings {
      return clone(current);
    },
  };
}

function createAccount(accountId: string): MailTransportAccountConfig {
  return {
    id: accountId,
    providerType: "gmail",
    email: "local@example.com",
    enabled: true,
    connectionState: "connected",
    authType: "password",
    imap: {
      host: "imap.example.com",
      port: 993,
      secure: true,
    },
    smtp: {
      host: "smtp.example.com",
      port: 465,
      secure: true,
    },
    auth: {
      user: "local@example.com",
      password: "app-password",
    },
  };
}

function createSettings(accountId: string): AppSettings {
  const settings = createDefaultSettings();
  settings.user = {
    nickname: "Local Ghost",
    avatarPath: "",
  };
  settings.integrations = {
    ...(settings.integrations ?? {}),
    mailTransport: {
      accounts: [createAccount(accountId)],
      retryBaseMs: 1,
      maxRetries: 0,
    },
  };
  settings.remoteUsers = [
    {
      remoteUserId: "remote@example.com",
      email: "remote@example.com",
      nickname: "Remote Old",
      avatar: "",
      handshakeState: "active",
      profileRevision: 1,
      linkedMailAccountId: accountId,
      threadMessageId: null,
      lastTransportMessageId: null,
      lastError: null,
    },
  ];
  settings.us1Slot = {
    selectedRemoteUserId: "remote@example.com",
    connectionState: "connected",
    catchCommands: false,
  };
  return normalizeSettings(settings);
}

function createMultiRemoteSettings(
  selectedRemoteUserId: string,
  bindings: Array<{
    accountId: string;
    remoteUserId: string;
    nickname: string;
  }>
): AppSettings {
  const settings = createDefaultSettings();
  settings.user = {
    nickname: "Local Ghost",
    avatarPath: "",
  };
  settings.integrations = {
    ...(settings.integrations ?? {}),
    mailTransport: {
      accounts: bindings.map((binding) => createAccount(binding.accountId)),
      retryBaseMs: 1,
      maxRetries: 0,
    },
  };
  settings.remoteUsers = bindings.map((binding, index) => ({
    remoteUserId: binding.remoteUserId,
    email: binding.remoteUserId,
    nickname: binding.nickname,
    avatar: "",
    handshakeState: "active" as const,
    profileRevision: index + 1,
    linkedMailAccountId: binding.accountId,
    threadMessageId: null,
    lastTransportMessageId: null,
    lastError: null,
  }));
  settings.us1Slot = {
    selectedRemoteUserId,
    connectionState: "connected",
    catchCommands: false,
  };
  return normalizeSettings(settings);
}

function createTransportStub() {
  const sentMessages: SendMailRequest[] = [];
  const sentAccountIds: string[] = [];
  const fetchQueue: FetchInboxResult[] = [];

  return {
    sentMessages,
    sentAccountIds,
    enqueueFetch(result: FetchInboxResult): void {
      fetchQueue.push(result);
    },
    transport: {
      async sendMail(account: { id: string }, message: SendMailRequest) {
        sentAccountIds.push(account.id);
        sentMessages.push(clone(message));
        const transportMessageId = message.messageId ?? `<${message.localMessageId}@example.test>`;
        return {
          accountId: account.id,
          localMessageId: message.localMessageId,
          transportMessageId,
          deliveryState: "sent" as const,
          headersHash: `hash:${message.localMessageId}`,
          accepted: ["remote@example.com"],
          rejected: [] as string[],
          pending: [] as string[],
          response: "250 queued",
          remoteUserId: message.remoteUserId ?? null,
          localSessionId: message.localSessionId ?? null,
          threadMessageId: message.threadMessageId ?? transportMessageId,
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

function buildConversationPayload(
  nickname: string,
  profileRevision: number,
  text: string,
  options: {
    localSessionId?: string | null;
    mode?: "new" | "reply";
    title?: string | null;
    sentAt?: number;
    profile?: {
      remoteUserId?: string;
      email?: string;
      nickname?: string;
      avatar?: string;
      profileRevision?: number;
    };
    roomEvent?: Record<string, unknown> | null;
    roomCommand?: Record<string, unknown> | null;
  } = {}
): string {
  const localSessionId = options.localSessionId ?? null;
  const sentAt = options.sentAt ?? FIXED_NOW + 1;
  const profile = {
    remoteUserId: options.profile?.remoteUserId ?? "remote@example.com",
    email: options.profile?.email ?? options.profile?.remoteUserId ?? "remote@example.com",
    nickname: options.profile?.nickname ?? nickname,
    avatar: options.profile?.avatar ?? "https://example.com/avatar.png",
    profileRevision: options.profile?.profileRevision ?? profileRevision,
  };
  return [
    text,
    "",
    MESSAGE_PAYLOAD_START,
    JSON.stringify(
      {
        protocol: MESSAGE_PROTOCOL,
        version: 1,
        messageType: "conversation",
        sentAt,
        localSessionId,
        session:
          localSessionId !== null
            ? {
                id: localSessionId,
                mode: options.mode ?? "reply",
                title: options.title ?? null,
                createdAt: sentAt,
                openHint: options.mode === "new" ? "auto_if_idle" : "list_only",
              }
            : null,
        profile,
        ...(options.roomEvent !== undefined && options.roomEvent !== null
          ? { roomEvent: options.roomEvent }
          : {}),
        ...(options.roomCommand !== undefined && options.roomCommand !== null
          ? { roomCommand: options.roomCommand }
          : {}),
      },
      null,
      2
    ),
    MESSAGE_PAYLOAD_END,
    "",
  ].join("\n");
}

function extractConversationEnvelope(message: SendMailRequest): Record<string, unknown> {
  const text = typeof message.text === "string" ? message.text : "";
  const match = text.match(
    /--- HAYALET_EV_US1_MESSAGE_PAYLOAD ---\s*([\s\S]+?)\s*--- \/HAYALET_EV_US1_MESSAGE_PAYLOAD ---/
  );
  assert.ok(match?.[1]);
  return JSON.parse(match[1]) as Record<string, unknown>;
}

function buildFetchedConversationMessage(options: {
  accountId: string;
  uid: number;
  transportMessageId: string;
  localMessageId: string;
  remoteUserId?: string;
  nickname?: string;
  profileRevision?: number;
  localSessionId?: string | null;
  text: string;
  subject?: string;
  threadMessageId?: string | null;
  sentAt?: number;
  mode?: "new" | "reply";
  title?: string | null;
  roomEvent?: Record<string, unknown> | null;
  roomCommand?: Record<string, unknown> | null;
}) {
  const remoteUserId = options.remoteUserId ?? "remote@example.com";
  const nickname = options.nickname ?? "Remote Ghost";
  const sentAt = options.sentAt ?? FIXED_NOW + options.uid;
  const localSessionId = options.localSessionId ?? null;
  const threadMessageId = options.threadMessageId ?? options.transportMessageId;

  return {
    status: "processed",
    duplicate: false,
    accountId: options.accountId,
    mailbox: "INBOX",
    uid: options.uid,
    threadId: null,
    transportMessageId: options.transportMessageId,
    localMessageId: options.localMessageId,
    fingerprint: `fingerprint-${options.uid}`,
    headersHash: `headers-${options.uid}`,
    deliveryState: "received",
    remoteUserId,
    localSessionId,
    threadMessageId,
    parsed: {
      transportMessageId: options.transportMessageId,
      inReplyTo: null,
      references: [],
      subject: options.subject ?? "Remote conversation",
      text: buildConversationPayload(nickname, options.profileRevision ?? 1, options.text, {
        localSessionId,
        mode: options.mode,
        title: options.title,
        sentAt,
        profile: {
          remoteUserId,
          email: remoteUserId,
          nickname,
          profileRevision: options.profileRevision ?? 1,
        },
        roomEvent: options.roomEvent,
        roomCommand: options.roomCommand,
      }),
      html: null,
      headersHash: `headers-${options.uid}`,
      headerLines: [
        `X-Hayalet-Ev-Protocol: ${MESSAGE_PROTOCOL}`,
        ...(localSessionId !== null ? [`X-Hayalet-Ev-Session-Id: ${localSessionId}`] : []),
      ],
      from: [{ name: nickname, address: remoteUserId }],
      to: [],
      cc: [],
      bcc: [],
      replyTo: [],
      attachments: [],
      receivedAt: sentAt,
      rawSize: 256,
    },
  };
}

function cleanupAccount(accountId: string): void {
  closeMailSidecarDbForAccount(accountId);
  rmSync(Paths.getAccountDir(accountId), { recursive: true, force: true });
}

function ensureArchiveSchema(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      web_url TEXT NOT NULL,
      provider TEXT,
      title TEXT,
      title_source TEXT NOT NULL DEFAULT 'system',
      summary TEXT,
      message_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      role TEXT NOT NULL,
      author TEXT,
      content TEXT NOT NULL,
      dom_index INTEGER,
      dom_id TEXT,
      content_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function buildAttachmentPaths(
  accountId: string,
  conversationId: string,
  messageId: string,
  storedName: string
): { dirPath: string; storedPath: string } {
  const dirPath = join(Paths.getAccountDir(accountId), "attachments", conversationId, messageId);
  const storedPath = `data/${accountId}/attachments/${conversationId}/${messageId}/${storedName}`;
  return { dirPath, storedPath };
}

function createArchiveFactory() {
  return async (accountId: string) => {
    mkdirSync(Paths.getAccountDir(accountId), { recursive: true });
    const db = new Database(Paths.getAccountDbPath(accountId));
    ensureArchiveSchema(db);

    return {
      async upsertConversationMetadata(params: {
        webUrl: string;
        provider?: string;
        title?: string | null;
      }) {
        const conversationId = hashString(params.webUrl);
        const now = new Date(FIXED_NOW).toISOString();
        const normalizedTitle =
          typeof params.title === "string" && params.title.trim() !== "" ? params.title.trim() : "";
        const existing = db
          .prepare<[string], { id: string; title: string | null; title_source: string | null }>(
            "SELECT id, title, title_source FROM conversations WHERE id = ? LIMIT 1"
          )
          .get(conversationId);

        if (existing === undefined) {
          const countRow = db
            .prepare<[string], { count: number }>(
              "SELECT COUNT(*) as count FROM conversations WHERE account_id = ?"
            )
            .get(accountId);
          const nextTitle =
            normalizedTitle !== ""
              ? normalizedTitle
              : `Sohbet ${String((countRow?.count ?? 0) + 1).padStart(3, "0")}`;
          const titleSource = normalizedTitle !== "" ? "synced" : "system";
          db.prepare(
            `INSERT INTO conversations (id, account_id, web_url, provider, title, title_source, summary, message_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, '', 0, ?, ?)`
          ).run(
            conversationId,
            accountId,
            params.webUrl,
            params.provider ?? "us1",
            nextTitle,
            titleSource,
            now,
            now
          );
          return {
            success: true,
            data: {
              conversationId,
              created: true,
              title: nextTitle,
              titleUpdated: normalizedTitle !== "",
            },
          };
        }

        const updateParts = ["web_url = ?", "provider = ?", "updated_at = ?"];
        const updateValues: Array<string> = [params.webUrl, params.provider ?? "us1", now];
        let nextTitle = existing.title ?? "";
        let titleUpdated = false;

        if (
          normalizedTitle !== "" &&
          existing.title_source !== "user" &&
          existing.title !== normalizedTitle
        ) {
          updateParts.push("title = ?", "title_source = ?");
          updateValues.push(normalizedTitle, "synced");
          nextTitle = normalizedTitle;
          titleUpdated = true;
        }

        updateValues.push(conversationId);
        db.prepare(`UPDATE conversations SET ${updateParts.join(", ")} WHERE id = ?`).run(
          ...updateValues
        );
        return {
          success: true,
          data: {
            conversationId,
            created: false,
            title: nextTitle,
            titleUpdated,
          },
        };
      },

      async getMessages(conversationId: string) {
        const data = db
          .prepare<[string], { id: string; role: string; content: string }>(
            "SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY dom_index ASC, created_at ASC"
          )
          .all(conversationId);
        return { success: true, data };
      },

      async syncMessages(params: {
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
      }) {
        const conversationId = hashString(params.webUrl);
        const now = new Date(FIXED_NOW).toISOString();
        const insertMessage = db.prepare(
          `INSERT OR REPLACE INTO messages (id, conversation_id, account_id, role, author, content, dom_index, dom_id, content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const message of params.messages) {
          const domIndex = message.domIndex ?? message.index ?? 0;
          const contentHash = message.contentHash ?? hashString(message.text);
          const messageId =
            typeof message.domId === "string" && message.domId.trim() !== ""
              ? hashString(`${conversationId}-${message.domId}`)
              : hashString(`${conversationId}-${domIndex}-${contentHash}`);
          insertMessage.run(
            messageId,
            conversationId,
            accountId,
            message.role,
            message.author ?? null,
            message.text,
            domIndex,
            message.domId ?? null,
            contentHash,
            now
          );
        }

        const countRow = db
          .prepare<[string], { count: number }>(
            "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?"
          )
          .get(conversationId);
        db.prepare("UPDATE conversations SET message_count = ?, updated_at = ? WHERE id = ?").run(
          countRow?.count ?? 0,
          now,
          conversationId
        );

        return {
          success: true,
          conversationId,
          total: countRow?.count ?? 0,
          added: params.messages.length,
        };
      },

      async saveAttachment(
        conversationId: string,
        messageId: string,
        filePath: string,
        originalName: string,
        mimeType?: string
      ) {
        const attachmentId = hashString(`${messageId}:${originalName}:${FIXED_NOW}`);
        const storedName = `${attachmentId}_${originalName}`;
        const { dirPath, storedPath } = buildAttachmentPaths(accountId, conversationId, messageId, storedName);
        mkdirSync(dirPath, { recursive: true });
        copyFileSync(filePath, join(dirPath, storedName));
        const size = statSync(filePath).size;
        db.prepare(
          `INSERT OR REPLACE INTO attachments (id, message_id, conversation_id, account_id, original_name, stored_name, stored_path, mime_type, size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          attachmentId,
          messageId,
          conversationId,
          accountId,
          originalName,
          storedName,
          storedPath,
          mimeType ?? null,
          size,
          new Date(FIXED_NOW).toISOString()
        );
        return { success: true, data: { attachmentId, storedPath } };
      },

      async saveAttachmentContent(
        conversationId: string,
        messageId: string,
        content: Buffer,
        originalName: string,
        mimeType?: string
      ) {
        const attachmentId = hashString(`${messageId}:${originalName}:${FIXED_NOW}:content`);
        const storedName = `${attachmentId}_${originalName}`;
        const { dirPath, storedPath } = buildAttachmentPaths(accountId, conversationId, messageId, storedName);
        mkdirSync(dirPath, { recursive: true });
        writeFileSync(join(dirPath, storedName), content);
        db.prepare(
          `INSERT OR REPLACE INTO attachments (id, message_id, conversation_id, account_id, original_name, stored_name, stored_path, mime_type, size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          attachmentId,
          messageId,
          conversationId,
          accountId,
          originalName,
          storedName,
          storedPath,
          mimeType ?? null,
          content.length,
          new Date(FIXED_NOW).toISOString()
        );
        return { success: true, data: { attachmentId, storedPath } };
      },
    };
  };
}

test("US1 conversation service sends outbound mail and projects archive metadata", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const tempRoot = await mkdtemp(join(tmpdir(), "us1-mail-outbound-"));
  const attachmentPath = join(tempRoot, "note.txt");
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    await writeFile(attachmentPath, "outbound attachment", "utf8");

    const result = await service.sendMessage({
      text: "Outbound hello",
      attachments: [{ path: attachmentPath, name: "note.txt", mimeType: "text/plain" }],
    });

    assert.equal(result.success, true);
    assert.equal(transportStub.sentMessages.length, 1);
    assert.equal(transportStub.sentMessages[0]?.to, "remote@example.com");
    assert.equal(typeof result.transportMessageId, "string");
    assert.equal(typeof result.conversationId, "string");
    const envelope = extractConversationEnvelope(transportStub.sentMessages[0] as SendMailRequest);
    assert.equal(
      (envelope["session"] as Record<string, unknown>)?.["id"],
      result.localSessionId ?? null
    );
    assert.equal((envelope["session"] as Record<string, unknown>)?.["mode"], "new");
    assert.equal((envelope["session"] as Record<string, unknown>)?.["title"], null);

    const sidecar = new MailSidecarStoreManager(accountId);
    const meta = sidecar.getMessageMeta(result.transportMessageId ?? "");
    assert.equal(meta?.deliveryState, "sent");
    assert.equal(meta?.metadata?.["direction"], "outbound");
    assert.equal(meta?.metadata?.["localSessionId"], result.localSessionId);

    const db = new Database(Paths.getAccountDbPath(remoteAccountId), { readonly: true });
    const conversation = db
      .prepare<[string], { title: string | null }>(
        "SELECT title FROM conversations WHERE id = ? LIMIT 1"
      )
      .get(result.conversationId ?? "");
    const messages = db
      .prepare<[string], { role: string; content: string }>(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
      )
      .all(result.conversationId ?? "");
    const attachments = db
      .prepare<[string], { original_name: string }>(
        "SELECT original_name FROM attachments WHERE conversation_id = ? ORDER BY created_at ASC"
      )
      .all(result.conversationId ?? "");
    db.close();

    assert.equal(conversation?.title, "Sohbet 001");
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.role, "user");
    assert.equal(messages[0]?.content, "Outbound hello");
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0]?.original_name, "note.txt");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation service resolves provider credentials server-side for explicit remote users", async () => {
  const accountIdA = `us1_mail_${Date.now().toString(36)}_alpha_send`;
  const accountIdB = `us1_mail_${Date.now().toString(36)}_beta_send`;
  const store = createSettingsStore(
    createMultiRemoteSettings("alpha@example.com", [
      {
        accountId: accountIdA,
        remoteUserId: "alpha@example.com",
        nickname: "Alpha Remote",
      },
      {
        accountId: accountIdB,
        remoteUserId: "beta@example.com",
        nickname: "Beta Remote",
      },
    ])
  );
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountIdA = buildRemoteEmailAccountId("alpha@example.com");
  const remoteAccountIdB = buildRemoteEmailAccountId("beta@example.com");

  try {
    const result = await service.sendMessage({
      text: "Server resolved beta",
      remoteUserId: "beta@example.com",
    });

    assert.equal(result.success, true);
    assert.equal(result.remoteUserId, "beta@example.com");
    assert.equal(transportStub.sentMessages.length, 1);
    assert.equal(transportStub.sentMessages[0]?.to, "beta@example.com");
    assert.equal(transportStub.sentAccountIds[0], accountIdB);
    assert.equal(store.snapshot().us1Slot?.selectedRemoteUserId, "alpha@example.com");
  } finally {
    cleanupAccount(accountIdA);
    cleanupAccount(accountIdB);
    cleanupAccount(remoteAccountIdA);
    cleanupAccount(remoteAccountIdB);
  }
});

test(
  "US1 conversation service rejects foreign remote users outside the owner-scoped bindings",
  { concurrency: false },
  async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_foreign_send`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const logger = getLoggerCore() as unknown as {
    logInternal: (...args: unknown[]) => Promise<void>;
  };
  const originalLogInternal = logger.logInternal.bind(logger);
  const capturedContexts: Array<Record<string, unknown>> = [];
  logger.logInternal = async (
    _category: unknown,
    _level: unknown,
    _message: unknown,
    context?: unknown
  ) => {
    if (context !== null && context !== undefined && typeof context === "object") {
      capturedContexts.push(context as Record<string, unknown>);
    }
  };

  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const result = await service.sendMessage({
      text: "Should be rejected",
      remoteUserId: "foreign@example.com",
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /foreign@example\.com/);
    assert.equal(transportStub.sentMessages.length, 0);
    assert.equal(store.snapshot().us1Slot?.selectedRemoteUserId, "remote@example.com");
    assert.equal(
      capturedContexts.some((context) => context["eventCode"] === "auth.owner_scope_violation"),
      true
    );
  } finally {
    logger.logInternal = originalLogInternal;
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
  }
);

test("US1 conversation service ignores forged client session ids and mints owner-scoped ones", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_forged_session`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const result = await service.sendMessage({
      text: "Forged session attempt",
      localSessionId: "forged-session-id",
    });

    assert.equal(result.success, true);
    assert.notEqual(result.localSessionId, "forged-session-id");
    assert.equal(transportStub.sentMessages[0]?.localSessionId, result.localSessionId);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation service starts explicit new sessions as fresh mail threads", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_fresh_thread`;
  const initialSettings = createSettings(accountId);
  if (initialSettings.remoteUsers?.[0] !== undefined) {
    initialSettings.remoteUsers[0].threadMessageId = "<handshake-root@example.test>";
    initialSettings.remoteUsers[0].lastTransportMessageId = "<handshake-last@example.test>";
  }
  const store = createSettingsStore(initialSettings);
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const firstResult = await service.sendMessage({
      text: "Fresh branch",
      localSessionId: "fresh-session-1",
    });

    assert.equal(firstResult.success, true);
    assert.notEqual(firstResult.localSessionId, "fresh-session-1");
    assert.equal(typeof firstResult.localSessionId, "string");
    assert.equal(transportStub.sentMessages.length, 1);
    assert.equal(transportStub.sentMessages[0]?.threadMessageId, null);
    assert.equal(transportStub.sentMessages[0]?.inReplyTo, null);
    assert.equal(transportStub.sentMessages[0]?.references, undefined);
    const firstEnvelope = extractConversationEnvelope(transportStub.sentMessages[0] as SendMailRequest);
    assert.equal((firstEnvelope["session"] as Record<string, unknown>)?.["mode"], "new");

    const secondResult = await service.sendMessage({
      text: "Fresh follow up",
      localSessionId: firstResult.localSessionId,
    });

    assert.equal(secondResult.success, true);
    assert.equal(transportStub.sentMessages.length, 2);
    assert.equal(transportStub.sentMessages[1]?.threadMessageId, firstResult.transportMessageId);
    assert.equal(transportStub.sentMessages[1]?.inReplyTo, firstResult.transportMessageId);
    assert.deepEqual(transportStub.sentMessages[1]?.references, [
      firstResult.transportMessageId,
      firstResult.transportMessageId,
    ]);
    const secondEnvelope = extractConversationEnvelope(transportStub.sentMessages[1] as SendMailRequest);
    assert.equal((secondEnvelope["session"] as Record<string, unknown>)?.["mode"], "reply");

    const sidecar = new MailSidecarStoreManager(accountId);
    const mapping = sidecar.getSessionMapping("remote@example.com", firstResult.localSessionId ?? "");
    assert.equal(mapping?.threadMessageId, firstResult.transportMessageId);
    assert.equal(mapping?.lastMessageId, secondResult.transportMessageId);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation service retries are idempotent with the same clientRequestId", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_retry_send`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const first = await service.sendMessage({
      clientRequestId: "us1-client-req-1",
      text: "Retry once",
    });
    const second = await service.sendMessage({
      clientRequestId: "us1-client-req-1",
      text: "Retry once",
    });

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(transportStub.sentMessages.length, 1);
    assert.equal(first.transportMessageId, second.transportMessageId);
    assert.equal(first.brokerMessageId, second.brokerMessageId);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation service syncs inbound mail, updates remote profile, and flags room bundles", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_sync`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const outbound = await service.sendMessage({ text: "Thread opener" });
    assert.equal(outbound.success, true);

    const roomBundle = JSON.stringify(
      {
        manifest: {
          id: "mail-room",
          name: "Mail Room",
        },
        files: {
          "README.md": {
            encoding: "base64",
            content: Buffer.from("room").toString("base64"),
          },
        },
      },
      null,
      2
    );

    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:5",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        {
          status: "processed",
          duplicate: false,
          accountId,
          mailbox: "INBOX",
          uid: 5,
          threadId: null,
          transportMessageId: "<incoming-1@example.test>",
          localMessageId: "local-in-1",
          fingerprint: "fingerprint-in-1",
          headersHash: "headers-in-1",
          deliveryState: "received",
          remoteUserId: "remote@example.com",
          localSessionId: null,
          threadMessageId: outbound.transportMessageId ?? null,
          parsed: {
            transportMessageId: "<incoming-1@example.test>",
            inReplyTo: outbound.transportMessageId ?? null,
            references: outbound.transportMessageId ? [outbound.transportMessageId] : [],
            subject: "Re: Thread opener",
            text: buildConversationPayload("Remote Fresh", 10, "Inbound hello"),
            html: null,
            headersHash: "headers-in-1",
            headerLines: [`X-Hayalet-Ev-Protocol: ${MESSAGE_PROTOCOL}`],
            from: [{ name: "Remote Fresh", address: "remote@example.com" }],
            to: [],
            cc: [],
            bcc: [],
            replyTo: [],
            attachments: [
              {
                filename: "mail-room.hevroom.json",
                contentType: "application/json",
                contentDisposition: "attachment",
                checksum: "bundle-checksum",
                size: Buffer.byteLength(roomBundle),
                contentId: null,
                inline: false,
                content: Buffer.from(roomBundle),
              },
            ],
            receivedAt: FIXED_NOW + 1,
            rawSize: roomBundle.length,
          },
        },
      ],
    });

    const result = await service.syncMessages();

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 1);
    assert.equal(result.localSessionId, outbound.localSessionId);
    assert.equal(result.sessionEvents?.[0]?.mode, "reply");
    assert.equal(result.sessionEvents?.[0]?.isNewSession, false);
    assert.equal(result.roomPackages?.length, 1);
    assert.equal(result.roomPackages?.[0]?.originalName, "mail-room.hevroom.json");

    const nextRemoteUser = store.snapshot().remoteUsers?.find(
      (remoteUser) => remoteUser.remoteUserId === "remote@example.com"
    );
    assert.equal(nextRemoteUser?.nickname, "Remote Fresh");
    assert.equal(nextRemoteUser?.avatar, "https://example.com/avatar.png");
    assert.equal(nextRemoteUser?.profileRevision, 10);

    const sidecar = new MailSidecarStoreManager(accountId);
    const meta = sidecar.getMessageMeta("<incoming-1@example.test>");
    assert.equal(meta?.metadata?.["direction"], "inbound");
    assert.equal(meta?.metadata?.["localSessionId"], outbound.localSessionId);

    const db = new Database(Paths.getAccountDbPath(remoteAccountId), { readonly: true });
    const messages = db
      .prepare<[string], { role: string; content: string }>(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
      )
      .all(result.conversationId ?? "");
    const attachments = db
      .prepare<[string], { original_name: string }>(
        "SELECT original_name FROM attachments WHERE conversation_id = ? ORDER BY created_at ASC"
      )
      .all(result.conversationId ?? "");
    db.close();

    assert.equal(messages.length, 2);
    assert.equal(messages[1]?.role, "assistant");
    assert.equal(messages[1]?.content, "Inbound hello");
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0]?.original_name, "mail-room.hevroom.json");
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync keeps explicit inbound new session ids isolated", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_new_session`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:9",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        {
          status: "processed",
          duplicate: false,
          accountId,
          mailbox: "INBOX",
          uid: 9,
          threadId: null,
          transportMessageId: "<incoming-new-session@example.test>",
          localMessageId: "local-new-session-1",
          fingerprint: "fingerprint-new-session-1",
          headersHash: "headers-new-session-1",
          deliveryState: "received",
          remoteUserId: "remote@example.com",
          localSessionId: "us1-remote-session-1",
          threadMessageId: "<incoming-new-session@example.test>",
          parsed: {
            transportMessageId: "<incoming-new-session@example.test>",
            inReplyTo: null,
            references: [],
            subject: "Fresh remote session",
            text: buildConversationPayload("Remote Fresh", 12, "Brand new thread", {
              localSessionId: "us1-remote-session-1",
              mode: "new",
              title: "Fresh thread",
            }),
            html: null,
            headersHash: "headers-new-session-1",
            headerLines: [
              `X-Hayalet-Ev-Protocol: ${MESSAGE_PROTOCOL}`,
              "X-Hayalet-Ev-Session-Id: us1-remote-session-1",
            ],
            from: [{ name: "Remote Fresh", address: "remote@example.com" }],
            to: [],
            cc: [],
            bcc: [],
            replyTo: [],
            attachments: [],
            receivedAt: FIXED_NOW + 3,
            rawSize: 128,
          },
        },
      ],
    });

    const result = await service.syncMessages();

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 1);
    assert.equal(result.localSessionId, "us1-remote-session-1");
    assert.equal(result.sessionEvents?.length, 1);
    assert.equal(result.sessionEvents?.[0]?.localSessionId, "us1-remote-session-1");
    assert.equal(result.sessionEvents?.[0]?.mode, "new");
    assert.equal(result.sessionEvents?.[0]?.isNewSession, true);

    const db = new Database(Paths.getAccountDbPath(remoteAccountId), { readonly: true });
    const conversation = db
      .prepare<[string], { title: string; web_url: string }>(
        "SELECT title, web_url FROM conversations WHERE id = ? LIMIT 1"
      )
      .get(result.conversationId ?? "");
    db.close();

    assert.equal(conversation?.title, "Sohbet 001");
    assert.match(conversation?.web_url ?? "", /us1-remote-session-1/);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync does not activate unknown remote users from normal conversation mail", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_skip`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const activeRemoteAccountId = buildRemoteEmailAccountId("remote@example.com");
  const strangerRemoteAccountId = buildRemoteEmailAccountId("stranger@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:7",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        {
          status: "processed",
          duplicate: false,
          accountId,
          mailbox: "INBOX",
          uid: 7,
          threadId: null,
          transportMessageId: "<incoming-stranger@example.test>",
          localMessageId: "local-stranger-1",
          fingerprint: "fingerprint-stranger-1",
          headersHash: "headers-stranger-1",
          deliveryState: "received",
          remoteUserId: "stranger@example.com",
          localSessionId: null,
          threadMessageId: "<incoming-stranger@example.test>",
          parsed: {
            transportMessageId: "<incoming-stranger@example.test>",
            inReplyTo: null,
            references: [],
            subject: "New stranger thread",
            text: [
              "Hello from stranger",
              "",
              MESSAGE_PAYLOAD_START,
              JSON.stringify(
                {
                  protocol: MESSAGE_PROTOCOL,
                  version: 1,
                  messageType: "conversation",
                  sentAt: FIXED_NOW + 2,
                  localSessionId: null,
                  profile: {
                    remoteUserId: "stranger@example.com",
                    email: "stranger@example.com",
                    nickname: "Stranger",
                    avatar: "https://example.com/stranger.png",
                    profileRevision: 9,
                  },
                },
                null,
                2
              ),
              MESSAGE_PAYLOAD_END,
              "",
            ].join("\n"),
            html: null,
            headersHash: "headers-stranger-1",
            headerLines: [`X-Hayalet-Ev-Protocol: ${MESSAGE_PROTOCOL}`],
            from: [{ name: "Stranger", address: "stranger@example.com" }],
            to: [],
            cc: [],
            bcc: [],
            replyTo: [],
            attachments: [],
            receivedAt: FIXED_NOW + 2,
            rawSize: 128,
          },
        },
      ],
    });

    const result = await service.syncMessages();

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 0);
    assert.equal(result.skippedCount, 1);
    assert.equal(
      store.snapshot().remoteUsers.some((remoteUser) => remoteUser.remoteUserId === "stranger@example.com"),
      false
    );
    assert.equal(existsSync(Paths.getAccountDbPath(activeRemoteAccountId)), false);
    assert.equal(existsSync(Paths.getAccountDbPath(strangerRemoteAccountId)), false);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(activeRemoteAccountId);
    cleanupAccount(strangerRemoteAccountId);
  }
});

test("US1 conversation service includes room event and room command metadata in outbound mail", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_meta`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const inviteResult = await service.sendMessage({
      text: "XOX invite from Game Room",
      roomEvent: {
        roomId: "game-room",
        featureId: "xox",
        inviteId: "invite-1",
        matchId: "invite-1",
        eventType: "invite",
        starter: "user",
        note: "Ready?",
      },
    });
    const commandResult = await service.sendMessage({
      localSessionId: inviteResult.localSessionId,
      text:
        '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomXoxRemoteMove","matchId":"invite-1","inviteId":"invite-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
      roomCommand: {
        roomId: "game-room",
        featureId: "xox",
        action: "room.command",
        commandName: "GameRoomXoxRemoteMove",
        roomPayload: {
          matchId: "invite-1",
          inviteId: "invite-1",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 4,
        },
        matchId: "invite-1",
        turnIndex: 0,
        boardHashBeforeMove: ".........",
        rawArgs:
          '{"matchId":"invite-1","inviteId":"invite-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
      },
    });

    assert.equal(inviteResult.success, true);
    assert.equal(commandResult.success, true);
    assert.equal(transportStub.sentMessages.length, 2);

    const inviteEnvelope = extractConversationEnvelope(transportStub.sentMessages[0] as SendMailRequest);
    const commandEnvelope = extractConversationEnvelope(transportStub.sentMessages[1] as SendMailRequest);

    assert.deepEqual(inviteEnvelope["roomEvent"], {
      roomId: "game-room",
      featureId: "xox",
      inviteId: "invite-1",
      matchId: "invite-1",
      eventType: "invite",
      starter: "user",
      note: "Ready?",
    });
    assert.deepEqual(commandEnvelope["roomCommand"], {
      roomId: "game-room",
      featureId: "xox",
      action: "room.command",
      commandName: "GameRoomXoxRemoteMove",
      roomPayload: {
        matchId: "invite-1",
        inviteId: "invite-1",
        turnIndex: 0,
        boardHashBeforeMove: ".........",
        cell: 4,
      },
      matchId: "invite-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      rawArgs:
        '{"matchId":"invite-1","inviteId":"invite-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
    });
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync projects room events, commands, and invite inbox entries", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_sync`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:31",
      fetchedCount: 2,
      processedCount: 2,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 31,
          transportMessageId: "<invite-room-sync@example.test>",
          localMessageId: "local-room-sync-invite",
          localSessionId: "room-sync-session",
          nickname: "Remote Player",
          text: "Incoming XOX invite",
          subject: "XOX invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "xox",
            inviteId: "invite-sync-1",
            matchId: "invite-sync-1",
            eventType: "invite",
            starter: "user",
            note: "Your turn first",
          },
        }),
        buildFetchedConversationMessage({
          accountId,
          uid: 32,
          transportMessageId: "<command-room-sync@example.test>",
          localMessageId: "local-room-sync-command",
          localSessionId: "room-sync-session",
          nickname: "Remote Player",
          text:
            '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomXoxRemoteMove","matchId":"invite-sync-1","inviteId":"invite-sync-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
          subject: "XOX move",
          roomCommand: {
            roomId: "game-room",
            featureId: "xox",
            action: "room.command",
            commandName: "GameRoomXoxRemoteMove",
            roomPayload: {
              matchId: "invite-sync-1",
              inviteId: "invite-sync-1",
              turnIndex: 0,
              boardHashBeforeMove: ".........",
              cell: 4,
            },
            matchId: "invite-sync-1",
            turnIndex: 0,
            boardHashBeforeMove: ".........",
            rawArgs:
              '{"matchId":"invite-sync-1","inviteId":"invite-sync-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
          },
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "room-sync-session" });

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 2);
    assert.equal(result.roomEvents?.length, 1);
    assert.equal(result.roomCommands?.length, 1);
    assert.equal(result.roomInviteInbox?.length, 1);
    assert.equal(result.roomEvents?.[0]?.inviteId, "invite-sync-1");
    assert.equal(result.roomEvents?.[0]?.matchId, "invite-sync-1");
    assert.equal(result.roomEvents?.[0]?.senderNickname, "Remote Player");
    assert.equal(result.roomCommands?.[0]?.commandName, "GameRoomXoxRemoteMove");
    assert.equal(result.roomCommands?.[0]?.action, "room.command");
    assert.deepEqual(result.roomCommands?.[0]?.roomPayload, {
      matchId: "invite-sync-1",
      inviteId: "invite-sync-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
    assert.deepEqual(result.roomCommands?.[0]?.commandArgs, {
      matchId: "invite-sync-1",
      inviteId: "invite-sync-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
    assert.equal(result.roomInviteInbox?.[0]?.remoteUserId, "remote@example.com");
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync falls back to inline SlotBridge room.command text", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_inline_cmd`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:41",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 41,
          transportMessageId: "<inline-room-command@example.test>",
          localMessageId: "local-inline-room-command",
          localSessionId: "room-inline-session",
          nickname: "Remote Player",
          text:
            '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomXoxRemoteMove","matchId":"invite-inline-1","inviteId":"invite-inline-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
          subject: "XOX move inline",
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "room-inline-session" });

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 1);
    assert.equal(result.roomCommands?.length, 1);
    assert.equal(result.roomCommands?.[0]?.roomId, "game-room");
    assert.equal(result.roomCommands?.[0]?.featureId, "xox");
    assert.equal(result.roomCommands?.[0]?.commandName, "GameRoomXoxRemoteMove");
    assert.equal(result.roomCommands?.[0]?.action, "room.command");
    assert.deepEqual(result.roomCommands?.[0]?.roomPayload, {
      matchId: "invite-inline-1",
      inviteId: "invite-inline-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
    assert.deepEqual(result.roomCommands?.[0]?.commandArgs, {
      matchId: "invite-inline-1",
      inviteId: "invite-inline-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync does not infer unknown inline room.command identities", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_inline_unknown`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:41b",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 41,
          transportMessageId: "<inline-room-command-unknown@example.test>",
          localMessageId: "local-inline-room-command-unknown",
          localSessionId: "room-inline-session-unknown",
          nickname: "Remote Player",
          text:
            '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomSecretRemoteMove","matchId":"invite-inline-unknown-1","inviteId":"invite-inline-unknown-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
          subject: "XOX move inline unknown",
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "room-inline-session-unknown" });

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 1);
    assert.equal(result.roomCommands?.length, 0);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync preserves pending room commands until a consumer drains them", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_pending_cmd`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:42",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 42,
          transportMessageId: "<pending-room-command@example.test>",
          localMessageId: "local-pending-room-command",
          localSessionId: "room-pending-session",
          nickname: "Remote Player",
          text:
            '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomXoxRemoteMove","matchId":"invite-pending-1","inviteId":"invite-pending-1","turnIndex":0,"boardHashBeforeMove":".........","cell":0}})',
          subject: "XOX move pending",
        }),
      ],
    });

    const previewResult = await service.syncMessages({ localSessionId: "room-pending-session" });
    const repeatedPreviewResult = await service.syncMessages({
      localSessionId: "room-pending-session",
    });
    const consumeResult = await service.syncMessages({
      localSessionId: "room-pending-session",
      consumeRoomCommands: true,
    });
    const drainedResult = await service.syncMessages({
      localSessionId: "room-pending-session",
      consumeRoomCommands: true,
    });

    assert.equal(previewResult.success, true);
    assert.equal(previewResult.roomCommands?.length, 1);
    assert.equal(repeatedPreviewResult.success, true);
    assert.equal(repeatedPreviewResult.roomCommands?.length, 1);
    assert.equal(repeatedPreviewResult.duplicateCount, 0);
    assert.equal(consumeResult.success, true);
    assert.equal(consumeResult.roomCommands?.length, 1);
    assert.equal(consumeResult.roomCommands?.[0]?.commandName, "GameRoomXoxRemoteMove");
    assert.equal(drainedResult.success, true);
    assert.equal(drainedResult.roomCommands?.length, 0);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation service preserves Team Tetris start events and turnToken metadata", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_team_tetris_meta`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const startResult = await service.sendMessage({
      text: "Team Tetris match started.",
      roomEvent: {
        roomId: "game-room",
        featureId: "team-tetris",
        inviteId: "tt-match-1",
        matchId: "tt-match-1",
        eventType: "start",
        note: '{"seed":"tt-seed","hiddenPairs":true}',
      },
    });
    const commandResult = await service.sendMessage({
      localSessionId: startResult.localSessionId,
      text:
        '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomTeamTetrisRemoteMove","schemaVersion":1,"matchId":"tt-match-1","turnIndex":2,"turnToken":"tt_token","pieceId":"T","rotation":1,"rowShifts":[0,1,0]}})',
      roomCommand: {
        roomId: "game-room",
        featureId: "team-tetris",
        action: "room.command",
        commandName: "GameRoomTeamTetrisRemoteMove",
        roomPayload: {
          schemaVersion: 1,
          matchId: "tt-match-1",
          turnIndex: 2,
          turnToken: "tt_token",
          pieceId: "T",
          rotation: 1,
          rowShifts: [0, 1, 0],
        },
        matchId: "tt-match-1",
        turnIndex: 2,
        turnToken: "tt_token",
        boardHashBeforeMove: "..........|..........",
        rawArgs:
          '{"schemaVersion":1,"matchId":"tt-match-1","turnIndex":2,"turnToken":"tt_token","pieceId":"T","rotation":1,"rowShifts":[0,1,0]}',
      },
    });

    assert.equal(startResult.success, true);
    assert.equal(commandResult.success, true);

    const startEnvelope = extractConversationEnvelope(transportStub.sentMessages[0] as SendMailRequest);
    const commandEnvelope = extractConversationEnvelope(transportStub.sentMessages[1] as SendMailRequest);

    assert.deepEqual(startEnvelope["roomEvent"], {
      roomId: "game-room",
      featureId: "team-tetris",
      inviteId: "tt-match-1",
      matchId: "tt-match-1",
      eventType: "start",
      note: '{"seed":"tt-seed","hiddenPairs":true}',
    });
    assert.deepEqual(commandEnvelope["roomCommand"], {
      roomId: "game-room",
      featureId: "team-tetris",
      action: "room.command",
      commandName: "GameRoomTeamTetrisRemoteMove",
      roomPayload: {
        schemaVersion: 1,
        matchId: "tt-match-1",
        turnIndex: 2,
        turnToken: "tt_token",
        pieceId: "T",
        rotation: 1,
        rowShifts: [0, 1, 0],
      },
      matchId: "tt-match-1",
      turnIndex: 2,
      turnToken: "tt_token",
      boardHashBeforeMove: "..........|..........",
      rawArgs:
        '{"schemaVersion":1,"matchId":"tt-match-1","turnIndex":2,"turnToken":"tt_token","pieceId":"T","rotation":1,"rowShifts":[0,1,0]}',
    });
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});

test("US1 conversation sync keeps invite inbox entries from all registered remote accounts", async () => {
  const accountIdA = `us1_mail_${Date.now().toString(36)}_multi_a`;
  const accountIdB = `us1_mail_${Date.now().toString(36)}_multi_b`;
  const store = createSettingsStore(
    createMultiRemoteSettings("alpha@example.com", [
      {
        accountId: accountIdA,
        remoteUserId: "alpha@example.com",
        nickname: "Alpha Remote",
      },
      {
        accountId: accountIdB,
        remoteUserId: "beta@example.com",
        nickname: "Beta Remote",
      },
    ])
  );
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountIdA = buildRemoteEmailAccountId("alpha@example.com");
  const remoteAccountIdB = buildRemoteEmailAccountId("beta@example.com");

  try {
    transportStub.enqueueFetch({
      accountId: accountIdA,
      mailbox: "INBOX",
      cursor: "uid:41",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId: accountIdA,
          uid: 41,
          transportMessageId: "<invite-alpha@example.test>",
          localMessageId: "local-alpha-invite",
          remoteUserId: "alpha@example.com",
          nickname: "Alpha Remote",
          localSessionId: "alpha-session",
          text: "Alpha invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "xox",
            inviteId: "invite-alpha",
            matchId: "invite-alpha",
            eventType: "invite",
            starter: "user",
            note: "Alpha note",
          },
        }),
      ],
    });
    transportStub.enqueueFetch({
      accountId: accountIdB,
      mailbox: "INBOX",
      cursor: "uid:42",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId: accountIdB,
          uid: 42,
          transportMessageId: "<invite-beta@example.test>",
          localMessageId: "local-beta-invite",
          remoteUserId: "beta@example.com",
          nickname: "Beta Remote",
          localSessionId: "beta-session",
          text: "Beta invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "xox",
            inviteId: "invite-beta",
            matchId: "invite-beta",
            eventType: "invite",
            starter: "opponent",
            note: "Beta note",
          },
        }),
      ],
    });

    const result = await service.syncMessages();

    assert.equal(result.success, true);
    assert.equal(result.fetchedCount, 2);
    assert.equal(result.roomInviteInbox?.length, 2);
    assert.deepEqual(
      result.roomInviteInbox?.map((entry) => entry.remoteUserId).sort(),
      ["alpha@example.com", "beta@example.com"]
    );
    assert.equal(result.remoteUserId, "alpha@example.com");
  } finally {
    cleanupAccount(accountIdA);
    cleanupAccount(accountIdB);
    cleanupAccount(remoteAccountIdA);
    cleanupAccount(remoteAccountIdB);
  }
});

test("US1 conversation service projects reset lifecycle events and clears invite inbox", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_reset`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:51",
      fetchedCount: 2,
      processedCount: 2,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 51,
          transportMessageId: "<invite-reset-sync@example.test>",
          localMessageId: "local-reset-invite",
          localSessionId: "reset-sync-session",
          nickname: "Remote Player",
          text: "Incoming XOX invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "xox",
            inviteId: "invite-reset-sync",
            matchId: "invite-reset-sync",
            eventType: "invite",
            starter: "user",
          },
        }),
        buildFetchedConversationMessage({
          accountId,
          uid: 52,
          transportMessageId: "<reset-sync@example.test>",
          localMessageId: "local-reset-event",
          localSessionId: "reset-sync-session",
          nickname: "Remote Player",
          text: "XOX match reset.",
          roomEvent: {
            roomId: "game-room",
            featureId: "xox",
            inviteId: "invite-reset-sync",
            matchId: "invite-reset-sync",
            eventType: "reset",
          },
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "reset-sync-session" });

    assert.equal(result.success, true);
    assert.equal(result.roomEvents?.length, 2);
    assert.equal(result.roomEvents?.[1]?.eventType, "reset");
    assert.equal(result.roomEvents?.[1]?.matchId, "invite-reset-sync");
    assert.equal(result.roomInviteInbox?.length, 0);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
