import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { MailSidecarStoreManager } from "../../electron/database/mail-sidecar-manager.ts";
import { closeMailSidecarDatabaseForAccount as closeMailSidecarDbForAccount } from "../../electron/database/mail-sidecar-sqlite.ts";
import Database from "../../electron/native/better-sqlite3.ts";
import { initPaths, Paths } from "../../electron/paths.ts";
import { Us1ConversationService } from "../../electron/us1-conversation-service.ts";
import { hashString } from "../../electron/database/hash-utils.ts";
import { buildUs1ProjectedAccountId } from "../../src/types/archive.ts";
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

function createTransportStub() {
  const sentMessages: SendMailRequest[] = [];
  const fetchQueue: FetchInboxResult[] = [];

  return {
    sentMessages,
    enqueueFetch(result: FetchInboxResult): void {
      fetchQueue.push(result);
    },
    transport: {
      async sendMail(account: { id: string }, message: SendMailRequest) {
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

function buildConversationPayload(nickname: string, profileRevision: number, text: string): string {
  return [
    text,
    "",
    MESSAGE_PAYLOAD_START,
    JSON.stringify(
      {
        protocol: MESSAGE_PROTOCOL,
        version: 1,
        messageType: "conversation",
        sentAt: FIXED_NOW + 1,
        localSessionId: null,
        profile: {
          remoteUserId: "remote@example.com",
          email: "remote@example.com",
          nickname,
          avatar: "https://example.com/avatar.png",
          profileRevision,
        },
      },
      null,
      2
    ),
    MESSAGE_PAYLOAD_END,
    "",
  ].join("\n");
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
        const existing = db
          .prepare<[string], { id: string; title: string | null }>(
            "SELECT id, title FROM conversations WHERE id = ? LIMIT 1"
          )
          .get(conversationId);

        if (existing === undefined) {
          db.prepare(
            `INSERT INTO conversations (id, account_id, web_url, provider, title, title_source, summary, message_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'synced', '', 0, ?, ?)`
          ).run(
            conversationId,
            accountId,
            params.webUrl,
            params.provider ?? "us1",
            params.title ?? "",
            now,
            now
          );
          return {
            success: true,
            data: {
              conversationId,
              created: true,
              title: params.title ?? "",
              titleUpdated: true,
            },
          };
        }

        db.prepare(
          "UPDATE conversations SET web_url = ?, provider = ?, title = ?, updated_at = ? WHERE id = ?"
        ).run(params.webUrl, params.provider ?? "us1", params.title ?? existing.title ?? "", now, conversationId);
        return {
          success: true,
          data: {
            conversationId,
            created: false,
            title: params.title ?? existing.title ?? "",
            titleUpdated: params.title !== undefined && params.title !== existing.title,
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
  const projectedAccountId = buildUs1ProjectedAccountId("remote@example.com");

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

    const sidecar = new MailSidecarStoreManager(accountId);
    const meta = sidecar.getMessageMeta(result.transportMessageId ?? "");
    assert.equal(meta?.deliveryState, "sent");
    assert.equal(meta?.metadata?.["direction"], "outbound");
    assert.equal(meta?.metadata?.["localSessionId"], result.localSessionId);

    const db = new Database(Paths.getAccountDbPath(projectedAccountId), { readonly: true });
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

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.role, "user");
    assert.equal(messages[0]?.content, "Outbound hello");
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0]?.original_name, "note.txt");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    cleanupAccount(accountId);
    cleanupAccount(projectedAccountId);
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
  const projectedAccountId = buildUs1ProjectedAccountId("remote@example.com");

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

    const db = new Database(Paths.getAccountDbPath(projectedAccountId), { readonly: true });
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
    cleanupAccount(projectedAccountId);
  }
});
