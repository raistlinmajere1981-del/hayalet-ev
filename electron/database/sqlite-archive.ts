import type { Conversation, Message, IpcResult } from "@electron/types";
import type Database from "better-sqlite3";
import { getLoggerCore } from "../logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { loadSettings } from "../settings-manager.ts";
import { DEFAULT_APP_LANGUAGE, type TranslationParams } from "../../src/types/i18n.ts";
import { loadAvailableLanguage } from "../i18n/language-service.ts";
import { translateCatalog } from "../../shared/i18n/catalog.js";
import { getBuiltInLanguagePack } from "../../shared/i18n/bundled-languages.js";
import { normalizeAppLanguage } from "../../shared/i18n/locale.js";
import { hashString } from "./hash-utils.js";
import { createMessageDedupeKey } from "./message-dedupe.js";
import { getDatabaseForAccount, getAttachmentPath, ensureAttachmentDir } from "./sqlite-manager.js";
import { copyFileSync, statSync, existsSync } from "fs";
import type { SyncMessagesParams, SyncMessagesResult } from "@electron/types";

const logger = getLoggerCore();

async function archiveT(key: string): Promise<string> {
  let settings: { general?: { language?: unknown } };
  try {
    settings = ((await loadSettings()) ?? {}) as { general?: { language?: unknown } };
  } catch {
    settings = {};
  }

  const locale = normalizeAppLanguage(settings.general?.language);
  const fallbackPack = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE);
  const activePack = (await loadAvailableLanguage(locale)) ?? fallbackPack;
  const activeCatalog = activePack?.catalog ?? {};
  const fallbackCatalog = fallbackPack?.catalog;

  return translateCatalog(activeCatalog, `electron.archive.${key}`, undefined, fallbackCatalog);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return typeof error === "string" && error !== "" ? error : "unknown";
}

async function logDatabaseInfo(
  key: string,
  params?: TranslationParams,
  context?: Record<string, unknown>
): Promise<void> {
  await logger.logInternalT(
    LogCategory.DATABASE,
    LogLevel.INFO,
    `electron.database.logs.${key}`,
    params,
    context
  );
}

async function logDatabaseError(
  operation: string,
  context: Record<string, unknown>
): Promise<void> {
  await logger.logInternalT(
    LogCategory.DATABASE,
    LogLevel.ERROR,
    "electron.database.logs.operationFailed",
    {
      operation,
      message: getErrorMessage(context["error"]),
    },
    context
  );
}

interface SearchMessageResult extends Message {
  conversation_title?: string;
  snippet?: string;
  web_url?: string;
}

interface SearchAttachmentResult {
  id: string;
  message_id: string;
  conversation_id: string;
  conversation_title: string;
  web_url: string;
  original_name: string;
  stored_path: string;
  mime_type: string | null;
  size: number;
  created_at: number;
}

type ConversationTitleSource = "system" | "synced" | "user";

export class SQLiteArchiveManager {
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  private getDb(): Database.Database {
    return getDatabaseForAccount(this.accountId);
  }

  private extractProvider(webUrl: string): string {
    if (webUrl.includes("chatgpt.com")) return "chatgpt";
    if (webUrl.includes("gemini.google.com")) return "gemini";
    if (webUrl.includes("grok")) return "grok";
    if (webUrl.includes("opencode")) return "opencode";
    return "unknown";
  }

  private generateConversationId(webUrl: string): string {
    return hashString(webUrl);
  }

  private generateMessageId(
    conversationId: string,
    domIndex: number,
    contentHash: string,
    domId?: string | null
  ): string {
    const normalizedDomId = (domId ?? "").trim();
    if (normalizedDomId !== "") {
      return hashString(`${conversationId}-${normalizedDomId}`);
    }

    return hashString(`${conversationId}-${domIndex}-${contentHash}`);
  }

  private async buildAutoTitle(db: Database.Database): Promise<string> {
    const countStmt = db.prepare(
      `SELECT COUNT(*) as count FROM conversations WHERE account_id = ?`
    );
    const count = (countStmt.get(this.accountId) as { count: number }).count;
    const prefix = await archiveT("autoTitlePrefix");
    return `${prefix} ${String(count + 1).padStart(3, "0")}`;
  }

  private normalizeConversationTitle(title?: string | null): string {
    return typeof title === "string" ? title.trim() : "";
  }

  private getConversationIdentity(webUrl: string): {
    conversationId: string;
    provider: string;
  } {
    return {
      conversationId: this.generateConversationId(webUrl),
      provider: this.extractProvider(webUrl),
    };
  }

  async getConversations(): Promise<IpcResult<Conversation[]>> {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT * FROM conversations 
        WHERE account_id = ? 
        ORDER BY updated_at DESC
      `);
      const rows = stmt.all(this.accountId) as Array<{
        id: string;
        web_url: string;
        title: string | null;
        summary: string | null;
        message_count: number;
        last_message_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
      const untitledConversation = await archiveT("untitledConversation");

      const conversations = rows.map((row) => ({
        id: row.id,
        web_url: row.web_url,
        webUrl: row.web_url,
        title: row.title ?? untitledConversation,
        summary: row.summary ?? "",
        message_count: row.message_count,
        messageCount: row.message_count,
        last_message_id: row.last_message_id,
        created_at: new Date(row.created_at).getTime(),
        updated_at: new Date(row.updated_at).getTime(),
      }));

      return { success: true, data: conversations };
    } catch (err) {
      await logDatabaseError("getConversations", {
        accountId: this.accountId,
        error: err,
      });
      return { success: false, error: (err as Error).message, data: [] };
    }
  }

  async getMessages(conversationId: string): Promise<IpcResult<Message[]>> {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? AND account_id = ?
        ORDER BY dom_index ASC, created_at ASC
      `);
      const rows = stmt.all(conversationId, this.accountId) as Array<{
        id: string;
        conversation_id: string;
        role: string;
        author: string | null;
        content: string;
        dom_index: number | null;
        dom_id: string | null;
        content_hash: string | null;
        created_at: string;
      }>;

      const messages: Message[] = rows.map((row) => ({
        id: row.id,
        conversation_id: row.conversation_id,
        role: row.role as "user" | "assistant",
        author: row.author,
        content: row.content,
        dom_index: row.dom_index,
        dom_id: row.dom_id,
        content_hash: row.content_hash,
        created_at: new Date(row.created_at).getTime(),
      }));

      return { success: true, data: messages };
    } catch (err) {
      await logDatabaseError("getMessages", {
        accountId: this.accountId,
        conversationId,
        error: err,
      });
      return { success: false, error: (err as Error).message, data: [] };
    }
  }

  async syncMessages(params: SyncMessagesParams): Promise<SyncMessagesResult> {
    const { webUrl, messages } = params;
    const db = this.getDb();

    try {
      const { conversationId, provider } = this.getConversationIdentity(webUrl);
      const now = new Date().toISOString();
      const autoTitle = await this.buildAutoTitle(db);

      const convStmt = db.prepare(`
        INSERT INTO conversations (id, account_id, web_url, provider, title, title_source, summary, message_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at
      `);
      convStmt.run(
        conversationId,
        this.accountId,
        webUrl,
        provider,
        autoTitle,
        "system",
        "",
        now,
        now
      );

      const hashStmt = db.prepare(
        `SELECT content_hash, dom_index, dom_id FROM messages WHERE conversation_id = ?`
      );
      const existingMessageKeys = new Set(
        (
          hashStmt.all(conversationId) as Array<{
            content_hash: string | null;
            dom_index: number | null;
            dom_id: string | null;
          }>
        ).map((row) => createMessageDedupeKey(row.dom_index, row.content_hash, row.dom_id))
      );

      const insertStmt = db.prepare(`
        INSERT INTO messages (id, conversation_id, account_id, role, author, content, dom_index, dom_id, content_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const [fallbackUserAuthor, fallbackAssistantAuthor] = await Promise.all([
        archiveT("fallbackUserAuthor"),
        archiveT("fallbackAssistantAuthor"),
      ]);

      let addedCount = 0;
      db.exec("BEGIN");
      try {
        for (const msg of messages) {
          const contentHash = msg.contentHash ?? hashString(msg.text);
          const domIndex = msg.index ?? 0;
          const dedupeKey = createMessageDedupeKey(domIndex, contentHash, msg.domId);

          if (existingMessageKeys.has(dedupeKey)) continue;
          existingMessageKeys.add(dedupeKey);

          const messageId = this.generateMessageId(
            conversationId,
            domIndex,
            contentHash,
            msg.domId
          );
          insertStmt.run(
            messageId,
            conversationId,
            this.accountId,
            msg.role,
            msg.author ?? (msg.role === "user" ? fallbackUserAuthor : fallbackAssistantAuthor),
            msg.text,
            domIndex,
            msg.domId ?? null,
            contentHash,
            now
          );
          addedCount++;
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }

      const totalStmt = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`
      );
      const totalCount = (totalStmt.get(conversationId) as { count: number }).count;

      const updateStmt = db.prepare(`
        UPDATE conversations 
        SET message_count = ?, updated_at = ?
        WHERE id = ?
      `);
      updateStmt.run(totalCount, now, conversationId);

      await logDatabaseInfo(
        "syncMessagesComplete",
        { added: addedCount, total: totalCount },
        {
          accountId: this.accountId,
          conversationId,
          added: addedCount,
          total: totalCount,
        }
      );

      return {
        success: true,
        conversationId,
        added: addedCount,
        total: totalCount,
      };
    } catch (err) {
      await logDatabaseError("syncMessages", {
        accountId: this.accountId,
        webUrl,
        error: err,
      });
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  async updateConversation(
    conversationId: string,
    data: { title?: string; summary?: string }
  ): Promise<IpcResult<void>> {
    try {
      const db = this.getDb();
      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (data.title !== undefined) {
        updates.push("title = ?");
        params.push(data.title);
        updates.push("title_source = ?");
        params.push("user");
      }
      if (data.summary !== undefined) {
        updates.push("summary = ?");
        params.push(data.summary);
      }

      if (updates.length === 0) {
        return { success: true };
      }

      updates.push("updated_at = ?");
      params.push(new Date().toISOString());
      params.push(conversationId);
      params.push(this.accountId);

      const stmt = db.prepare(`
        UPDATE conversations 
        SET ${updates.join(", ")}
        WHERE id = ? AND account_id = ?
      `);
      stmt.run(...params);

      return { success: true };
    } catch (err) {
      await logDatabaseError("updateConversation", {
        accountId: this.accountId,
        conversationId,
        error: err,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async upsertConversationMetadata(params: {
    webUrl: string;
    provider?: string;
    title?: string | null;
  }): Promise<
    IpcResult<{
      conversationId: string;
      created: boolean;
      title: string;
      titleUpdated: boolean;
    }>
  > {
    try {
      const db = this.getDb();
      const now = new Date().toISOString();
      const normalizedTitle = this.normalizeConversationTitle(params.title);
      const { conversationId, provider } = this.getConversationIdentity(params.webUrl);
      const effectiveProvider =
        typeof params.provider === "string" && params.provider.trim() !== ""
          ? params.provider.trim()
          : provider;

      const existingStmt = db.prepare(
        `SELECT title, title_source FROM conversations WHERE id = ? AND account_id = ? LIMIT 1`
      );
      const existing = existingStmt.get(conversationId, this.accountId) as
        | { title: string | null; title_source: ConversationTitleSource | null }
        | undefined;

      if (existing === undefined) {
        const nextTitle = normalizedTitle !== "" ? normalizedTitle : await this.buildAutoTitle(db);
        const titleSource: ConversationTitleSource = normalizedTitle !== "" ? "synced" : "system";
        const insertStmt = db.prepare(`
          INSERT INTO conversations (
            id,
            account_id,
            web_url,
            provider,
            title,
            title_source,
            summary,
            message_count,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, '', 0, ?, ?)
        `);
        insertStmt.run(
          conversationId,
          this.accountId,
          params.webUrl,
          effectiveProvider,
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

      const updates = ["web_url = ?", "provider = ?", "updated_at = ?"];
      const values: Array<string> = [params.webUrl, effectiveProvider, now];
      let nextTitle = existing.title ?? "";
      let titleUpdated = false;

      if (
        normalizedTitle !== "" &&
        existing.title_source !== "user" &&
        existing.title !== normalizedTitle
      ) {
        updates.push("title = ?", "title_source = ?");
        values.push(normalizedTitle, "synced");
        nextTitle = normalizedTitle;
        titleUpdated = true;
      }

      values.push(conversationId, this.accountId);
      const updateStmt = db.prepare(`
        UPDATE conversations
        SET ${updates.join(", ")}
        WHERE id = ? AND account_id = ?
      `);
      updateStmt.run(...values);

      return {
        success: true,
        data: {
          conversationId,
          created: false,
          title: nextTitle,
          titleUpdated,
        },
      };
    } catch (err) {
      await logDatabaseError("upsertConversationMetadata", {
        accountId: this.accountId,
        params,
        error: err,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async resetConversationMessages(
    webUrl: string
  ): Promise<IpcResult<{ conversationId: string; deletedCount: number }>> {
    try {
      const db = this.getDb();
      const { conversationId } = this.getConversationIdentity(webUrl);
      const countStmt = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND account_id = ?`
      );
      const deletedCount = (
        countStmt.get(conversationId, this.accountId) as { count: number } | undefined
      )?.count;

      const deleteStmt = db.prepare(
        `DELETE FROM messages WHERE conversation_id = ? AND account_id = ?`
      );
      deleteStmt.run(conversationId, this.accountId);

      const updateStmt = db.prepare(`
        UPDATE conversations
        SET message_count = 0, updated_at = ?
        WHERE id = ? AND account_id = ?
      `);
      updateStmt.run(new Date().toISOString(), conversationId, this.accountId);

      return {
        success: true,
        data: {
          conversationId,
          deletedCount: deletedCount ?? 0,
        },
      };
    } catch (err) {
      await logDatabaseError("resetConversationMessages", {
        accountId: this.accountId,
        webUrl,
        error: err,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async deleteConversation(conversationId: string): Promise<IpcResult<void>> {
    try {
      const db = this.getDb();

      const stmt = db.prepare(`DELETE FROM conversations WHERE id = ? AND account_id = ?`);
      stmt.run(conversationId, this.accountId);

      return { success: true };
    } catch (err) {
      await logDatabaseError("deleteConversation", {
        accountId: this.accountId,
        conversationId,
        error: err,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async searchMessages(query: string, limit = 50): Promise<IpcResult<SearchMessageResult[]>> {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT m.*, c.title as conversation_title, c.web_url
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.account_id = ? AND m.content LIKE ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(this.accountId, `%${query}%`, limit) as Array<{
        id: string;
        conversation_id: string;
        role: string;
        author: string | null;
        content: string;
        created_at: string;
        conversation_title: string;
        web_url: string;
      }>;

      const messages: SearchMessageResult[] = rows.map((row) => ({
        id: row.id,
        conversation_id: row.conversation_id,
        role: row.role as "user" | "assistant",
        author: row.author,
        content: row.content,
        dom_index: null,
        dom_id: null,
        content_hash: null,
        created_at: new Date(row.created_at).getTime(),
        conversation_title: row.conversation_title,
        snippet: row.content.substring(0, 200) + "...",
        web_url: row.web_url,
      }));

      return { success: true, data: messages };
    } catch (err) {
      await logDatabaseError("searchMessages", {
        accountId: this.accountId,
        query,
        error: err,
      });
      return { success: false, error: (err as Error).message, data: [] };
    }
  }

  async saveAttachment(
    conversationId: string,
    messageId: string,
    filePath: string,
    originalName: string,
    mimeType?: string
  ): Promise<IpcResult<{ attachmentId: string; storedPath: string }>> {
    try {
      const db = this.getDb();
      const attachmentId = hashString(`${messageId}-${originalName}-${Date.now()}`);
      const storedName = `${attachmentId}_${originalName}`;

      const attachDir = ensureAttachmentDir(this.accountId, conversationId, messageId);
      const targetPath = `${attachDir}/${storedName}`;

      let fileSize = 0;
      if (existsSync(filePath)) {
        const stats = statSync(filePath);
        fileSize = stats.size;
        copyFileSync(filePath, targetPath);
      }

      const relativePath = getAttachmentPath(this.accountId, conversationId, messageId, storedName);

      const stmt = db.prepare(`
        INSERT INTO attachments (id, message_id, conversation_id, account_id, original_name, stored_name, stored_path, mime_type, size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        attachmentId,
        messageId,
        conversationId,
        this.accountId,
        originalName,
        storedName,
        relativePath,
        mimeType ?? null,
        fileSize,
        new Date().toISOString()
      );

      await logDatabaseInfo(
        "attachmentSaved",
        { originalName },
        {
          attachmentId,
          messageId,
          originalName,
        }
      );

      return { success: true, data: { attachmentId, storedPath: relativePath } };
    } catch (err) {
      await logDatabaseError("saveAttachment", {
        accountId: this.accountId,
        conversationId,
        messageId,
        error: err,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async getAttachments(conversationId: string): Promise<
    IpcResult<
      Array<{
        id: string;
        message_id: string;
        original_name: string;
        stored_path: string;
        mime_type: string | null;
        size: number;
        created_at: number;
      }>
    >
  > {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT * FROM attachments 
        WHERE conversation_id = ? AND account_id = ?
        ORDER BY created_at ASC
      `);
      const rows = stmt.all(conversationId, this.accountId) as Array<{
        id: string;
        message_id: string;
        original_name: string;
        stored_path: string;
        mime_type: string | null;
        size: number;
        created_at: string;
      }>;

      const attachments = rows.map((row) => ({
        id: row.id,
        message_id: row.message_id,
        original_name: row.original_name,
        stored_path: row.stored_path,
        mime_type: row.mime_type,
        size: row.size,
        created_at: new Date(row.created_at).getTime(),
      }));

      return { success: true, data: attachments };
    } catch (err) {
      await logDatabaseError("getAttachments", {
        accountId: this.accountId,
        conversationId,
        error: err,
      });
      return { success: false, error: (err as Error).message, data: [] };
    }
  }

  async searchAttachments(query: string, limit = 50): Promise<IpcResult<SearchAttachmentResult[]>> {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT a.*, c.title as conversation_title, c.web_url
        FROM attachments a
        JOIN conversations c ON a.conversation_id = c.id
        WHERE a.account_id = ? AND a.original_name LIKE ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(this.accountId, `%${query}%`, limit) as Array<{
        id: string;
        message_id: string;
        conversation_id: string;
        original_name: string;
        stored_path: string;
        mime_type: string | null;
        size: number;
        created_at: string;
        conversation_title: string;
        web_url: string;
      }>;

      const attachments: SearchAttachmentResult[] = rows.map((row) => ({
        id: row.id,
        message_id: row.message_id,
        conversation_id: row.conversation_id,
        conversation_title: row.conversation_title,
        web_url: row.web_url,
        original_name: row.original_name,
        stored_path: row.stored_path,
        mime_type: row.mime_type,
        size: row.size,
        created_at: new Date(row.created_at).getTime(),
      }));

      return { success: true, data: attachments };
    } catch (err) {
      await logDatabaseError("searchAttachments", {
        accountId: this.accountId,
        query,
        error: err,
      });
      return { success: false, error: (err as Error).message, data: [] };
    }
  }

  async clearAccountData(): Promise<IpcResult<void>> {
    try {
      const db = this.getDb();

      const stmt = db.prepare(`DELETE FROM conversations WHERE account_id = ?`);
      stmt.run(this.accountId);

      await logDatabaseInfo(
        "accountDataCleared",
        { accountId: this.accountId },
        {
          accountId: this.accountId,
        }
      );

      return { success: true };
    } catch (err) {
      await logDatabaseError("clearAccountData", {
        accountId: this.accountId,
        error: err,
      });
      return { success: false, error: (err as Error).message };
    }
  }
}
