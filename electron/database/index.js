/**
 * DatabaseManager - Ana orchestrator
 *
 * Her hesap için ayrı SQLite veritabanı ve attachment yönetimi.
 * 
 * Account ID formatı: {provider}_{sanitizedEmail}
 * Örnek: chatgpt_user_at_gmail_com
 * 
 * Dosya yapısı:
 * data/
 * └── {accountId}/                  # Hesap klasörü (örn: chatgpt_user_at_gmail_com/)
 *     ├── database.db               # SQLite veritabanı
 *     └── attachments/              # Attachment dosyaları
 *         └── {conversationId}/     # Konuşma klasörü
 *             └── {messageId}/      # Mesaj klasörü
 *                 └── filename.ext  # Dosya
 *
 * @module electron/database
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { applySchema } from "./schema.js";
import { createQueries } from "./queries.js";
import { hashString, generateId as _generateId, generateMessageId, generateAttachmentId } from "./hash-utils.js";

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = "./data";

// ============================================================================
// Connection Pool
// ============================================================================

/** @type {Map<string, { db: Database.Database, queries: ReturnType<typeof createQueries> }>} */
const connectionPool = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Account ID'den klasör yolunu oluştur
 * @param {string} accountId - Account ID (örn: chatgpt_user_at_gmail_com)
 * @returns {string}
 */
function getAccountFolderPath(accountId) {
  return path.join(DATA_DIR, accountId);
}

/**
 * Account ID'den veritabanı dosya yolunu oluştur
 * @param {string} accountId
 * @returns {string}
 */
function getDatabasePath(accountId) {
  return path.join(getAccountFolderPath(accountId), "database.db");
}

/**
 * Account ID'den attachments klasör yolunu oluştur
 * @param {string} accountId
 * @returns {string}
 */
function getAttachmentsPath(accountId) {
  return path.join(getAccountFolderPath(accountId), "attachments");
}

/**
 * Hesap dizinlerinin var olduğundan emin ol
 * @param {string} accountId
 */
function ensureAccountDirectories(accountId) {
  const accountFolder = getAccountFolderPath(accountId);
  const attachmentsFolder = getAttachmentsPath(accountId);
  
  if (!fs.existsSync(accountFolder)) {
    fs.mkdirSync(accountFolder, { recursive: true });
  }
  if (!fs.existsSync(attachmentsFolder)) {
    fs.mkdirSync(attachmentsFolder, { recursive: true });
  }
}

// ============================================================================
// Database Manager
// ============================================================================

export const DatabaseManager = {
  /**
   * Hesap için veritabanını başlat
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId }
   * @returns {{ success: boolean, error?: string }}
   */
  initAccount(event, { accountId }) {
    try {
      if (!accountId) {
        return { success: false, error: "Account ID gerekli" };
      }

      // Hesap klasörlerini oluştur (database.db ve attachments/)
      ensureAccountDirectories(accountId);

      // Zaten açıksa başarılı dön
      if (connectionPool.has(accountId)) {
        return { success: true, cached: true };
      }

      const dbPath = getDatabasePath(accountId);
      const isNew = !fs.existsSync(dbPath);

      // Veritabanını aç
      const db = new Database(dbPath);

      // WAL modu ve optimizasyonlar
      db.pragma("journal_mode = WAL");
      db.pragma("synchronous = NORMAL");
      db.pragma("foreign_keys = ON");

      // Schema uygula
      applySchema(db);

      // Prepared statement'ları oluştur
      const queries = createQueries(db);

      // Pool'a ekle
      connectionPool.set(accountId, { db, queries });

      console.log(`[DB] ${isNew ? "Oluşturuldu" : "Açıldı"}: ${dbPath}`);

      return { success: true, created: isNew };
    } catch (err) {
      console.error("[DB] initAccount hatası:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Hesap için veritabanı bağlantısını al
   * @param {string} accountId - Account ID
   * @returns {{ db: Database.Database, queries: ReturnType<typeof createQueries> } | null}
   */
  getConnection(accountId) {
    if (!connectionPool.has(accountId)) {
      // Otomatik olarak bağlantı kur
      const result = this.initAccount(null, { accountId });
      if (!result.success) {
        console.error("[DB] getConnection - initAccount başarısız:", result.error);
        return null;
      }
    }

    return connectionPool.get(accountId) || null;
  },

  /**
   * Konuşmaları getir
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId }
   * @returns {Array}
   */
  getConversations(event, { accountId }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return [];
      }

      const rows = conn.queries.getConversations.all();

      // Archives sayfası formatına dönüştür
      // folder: tam yol olarak data/{accountId}/attachments/{conversationId}
      const attachmentsBase = getAttachmentsPath(accountId);
      
      return rows.map((row) => ({
        id: row.id,
        value: row.id,
        webUrl: row.web_url,
        title: row.title || "İsimsiz Konuşma",
        summary: row.summary || "",
        messageCount: row.message_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Tam yol: data/{accountId}/attachments/{conversationId}
        folder: path.join(attachmentsBase, row.id),
        label: row.title || "İsimsiz Konuşma",
      }));
    } catch (err) {
      console.error("[DB] getConversations hatası:", err);
      return [];
    }
  },

  /**
   * Konuşma mesajlarını getir
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, conversationId }
   * @returns {Array}
   */
  getMessages(event, { accountId, conversationId }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return [];
      }

      const rows = conn.queries.getMessages.all(conversationId);

      // Analyze sayfası formatına dönüştür
      return rows.map((row, index) => ({
        id: row.id,
        index: index,
        role: row.role,
        author: row.author || (row.role === "user" ? "Kullanıcı" : "AI"),
        text: row.content,
        contentHash: row.content_hash,
        domIndex: row.dom_index,
        domId: row.dom_id,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error("[DB] getMessages hatası:", err);
      return [];
    }
  },

  /**
   * Mesajları senkronize et (incremental sync)
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, webUrl, messages, authors }
   * @returns {{ success: boolean, added: number, conversationId: string }}
   */
  syncMessages(event, { accountId, webUrl, messages, authors }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return { success: false, error: "Veritabanı bağlantısı kurulamadı" };
      }

      const { db, queries } = conn;

      // Konuşmayı bul veya oluştur
      let conversation = queries.getConversationByUrl.get(webUrl);

      const now = Date.now();
      let conversationId;

      if (!conversation) {
        // Yeni konuşma ID'si - benzersiz ID (accountId prefix ile)
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        conversationId = `conv-${timestamp}-${random}`;

        queries.insertConversation.run({
          id: conversationId,
          web_url: webUrl,
          title: "",
          summary: "",
          message_count: 0,
          last_message_id: null,
          created_at: now,
          updated_at: now,
        });

        conversation = { id: conversationId };
      } else {
        conversationId = conversation.id;
      }

      // Mevcut mesaj hash'lerini al
      const existingHashes = new Set(
        queries.getMessageHashes.all(conversationId).map((r) => r.content_hash)
      );

      // Yeni mesajları filtrele
      const newMessages = [];
      for (const msg of messages) {
        const contentHash = msg.contentHash || hashString(msg.text);

        if (!existingHashes.has(contentHash)) {
          newMessages.push({
            ...msg,
            contentHash,
          });
        }
      }

      // Yeni mesajları ekle (transaction içinde)
      if (newMessages.length > 0) {
        const insertMany = db.transaction((msgs) => {
          for (const msg of msgs) {
            const messageId = generateMessageId();

            queries.insertMessage.run({
              id: messageId,
              conversation_id: conversationId,
              role: msg.role,
              author: msg.author || authors?.[msg.role] || null,
              content: msg.text,
              dom_index: msg.index ?? msg.domIndex ?? null,
              dom_id: msg.domId || null,
              content_hash: msg.contentHash,
              created_at: now,
            });
          }
        });

        insertMany(newMessages);
      }

      // Konuşma metadata'sını güncelle
      const messageCount = queries.getMessageCount.get(conversationId)?.count || 0;
      const lastMessage = queries.getLastMessage.get(conversationId);

      // Title: Mevcut başlık varsa değiştirme, yoksa "Sohbet001" formatında ata
      let title = conversation.title || "";
      if (!title) {
        // Mevcut konuşma sayısını al ve bir sonraki numarayı oluştur
        const convCount = queries.getConversationCount.get()?.count || 0;
        title = `Sohbet${String(convCount).padStart(3, "0")}`;
      }

      queries.updateConversation.run({
        id: conversationId,
        title,
        summary: conversation.summary || "",
        message_count: messageCount,
        last_message_id: lastMessage?.id || null,
        updated_at: now,
      });

      return {
        success: true,
        conversationId,
        added: newMessages.length,
        total: messageCount,
      };
    } catch (err) {
      console.error("[DB] syncMessages hatası:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Attachment kaydet
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, conversationId, messageId, filePath, originalName }
   * @returns {{ success: boolean, attachmentId: string, storedPath: string }}
   */
  saveAttachment(event, { accountId, conversationId, messageId, filePath, originalName, mimeType }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return { success: false, error: "Veritabanı bağlantısı kurulamadı" };
      }

      // Hedef klasörü oluştur: data/{accountId}/attachments/{conversationId}/{messageId}/
      const attachmentsBase = getAttachmentsPath(accountId);
      const targetDir = path.join(attachmentsBase, conversationId, messageId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Dosya adı çakışmasını önle
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext);
      let storedName = originalName;
      let counter = 1;

      while (fs.existsSync(path.join(targetDir, storedName))) {
        storedName = `${base}_${counter}${ext}`;
        counter++;
      }

      const storedPath = path.join(targetDir, storedName);

      // Dosyayı kopyala
      fs.copyFileSync(filePath, storedPath);

      // Dosya boyutunu al
      const stats = fs.statSync(storedPath);

      // DB'ye kaydet
      const attachmentId = generateAttachmentId();

      conn.queries.insertAttachment.run({
        id: attachmentId,
        message_id: messageId,
        conversation_id: conversationId,
        original_name: originalName,
        stored_name: storedName,
        stored_path: storedPath,
        mime_type: mimeType || null,
        size: stats.size,
        created_at: Date.now(),
      });

      return {
        success: true,
        attachmentId,
        storedPath,
      };
    } catch (err) {
      console.error("[DB] saveAttachment hatası:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Konuşmadaki attachment'ları getir
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, conversationId }
   * @returns {Array}
   */
  getAttachments(event, { accountId, conversationId }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return [];
      }

      const rows = conn.queries.getAttachmentsByConversation.all(conversationId);

      return rows.map((row) => ({
        id: row.id,
        messageId: row.message_id,
        originalName: row.original_name,
        storedName: row.stored_name,
        storedPath: row.stored_path,
        mimeType: row.mime_type,
        size: row.size,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error("[DB] getAttachments hatası:", err);
      return [];
    }
  },

  /**
   * Konuşmayı sil
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, conversationId }
   * @returns {{ success: boolean }}
   */
  deleteConversation(event, { accountId, conversationId }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return { success: false, error: "Veritabanı bağlantısı kurulamadı" };
      }

      // Attachment dosyalarını sil: data/{accountId}/attachments/{conversationId}/
      const attachmentsBase = getAttachmentsPath(accountId);
      const attachmentDir = path.join(attachmentsBase, conversationId);
      if (fs.existsSync(attachmentDir)) {
        fs.rmSync(attachmentDir, { recursive: true, force: true });
      }

      // DB'den sil (CASCADE ile messages ve attachments da silinir)
      conn.queries.deleteConversation.run(conversationId);

      return { success: true };
    } catch (err) {
      console.error("[DB] deleteConversation hatası:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Mesajlarda arama yap (FTS5)
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, query, limit }
   * @returns {Array}
   */
  searchMessages(event, { accountId, query, limit = 50 }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return [];
      }

      // FTS5 sorgusu için query'yi hazırla
      const ftsQuery = query
        .trim()
        .split(/\s+/)
        .map((term) => `"${term}"`)
        .join(" ");

      const rows = conn.queries.searchMessages.all(ftsQuery, limit);

      return rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title,
        webUrl: row.web_url,
        role: row.role,
        author: row.author,
        content: row.content,
        snippet: row.snippet,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error("[DB] searchMessages hatası:", err);
      return [];
    }
  },

  /**
   * Attachment'larda arama yap
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, query, limit }
   * @returns {Array}
   */
  searchAttachments(event, { accountId, query, limit = 50 }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return [];
      }

      // Dosya adında LIKE araması
      const searchPattern = `%${query}%`;
      const rows = conn.db.prepare(`
        SELECT 
          a.id,
          a.message_id,
          a.conversation_id,
          a.original_name,
          a.stored_path,
          a.mime_type,
          a.size,
          a.created_at,
          c.title as conversation_title,
          c.web_url
        FROM attachments a
        JOIN conversations c ON a.conversation_id = c.id
        WHERE a.original_name LIKE ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `).all(searchPattern, limit);

      return rows.map((row) => ({
        id: row.id,
        messageId: row.message_id,
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title || "İsimsiz Konuşma",
        webUrl: row.web_url,
        originalName: row.original_name,
        storedPath: row.stored_path,
        mimeType: row.mime_type,
        size: row.size,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error("[DB] searchAttachments hatası:", err);
      return [];
    }
  },

  /**
   * Tüm hesaplarda arama yap (mesaj + attachment)
   * @param {Object} event - IPC event
   * @param {Object} params - { query, limit }
   * @returns {{ messages: Array, attachments: Array }}
   */
  searchAllAccounts(event, { query, limit = 50 }) {
    try {
      // data/ klasöründeki tüm hesap klasörlerini bul
      if (!fs.existsSync(DATA_DIR)) {
        return { messages: [], attachments: [] };
      }

      const accountFolders = fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const allMessages = [];
      const allAttachments = [];

      for (const accountId of accountFolders) {
        // Mesajlarda ara
        const messages = this.searchMessages(event, { accountId, query, limit: Math.ceil(limit / accountFolders.length) });
        allMessages.push(...messages.map(m => ({ ...m, accountId })));

        // Attachment'larda ara
        const attachments = this.searchAttachments(event, { accountId, query, limit: Math.ceil(limit / accountFolders.length) });
        allAttachments.push(...attachments.map(a => ({ ...a, accountId })));
      }

      // Tarihe göre sırala ve limit uygula
      allMessages.sort((a, b) => b.createdAt - a.createdAt);
      allAttachments.sort((a, b) => b.createdAt - a.createdAt);

      return {
        messages: allMessages.slice(0, limit),
        attachments: allAttachments.slice(0, limit),
      };
    } catch (err) {
      console.error("[DB] searchAllAccounts hatası:", err);
      return { messages: [], attachments: [] };
    }
  },

  /**
   * Konuşma detayını güncelle
   * @param {Object} event - IPC event
   * @param {Object} params - { accountId, conversationId, title, summary }
   * @returns {{ success: boolean }}
   */
  updateConversationDetails(event, { accountId, conversationId, title, summary }) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (!conn) {
        return { success: false, error: "Veritabanı bağlantısı kurulamadı" };
      }

      const conversation = conn.queries.getConversationById.get(conversationId);
      if (!conversation) {
        return { success: false, error: "Konuşma bulunamadı" };
      }

      conn.queries.updateConversation.run({
        id: conversationId,
        title: title ?? conversation.title,
        summary: summary ?? conversation.summary,
        message_count: conversation.message_count,
        last_message_id: conversation.last_message_id,
        updated_at: Date.now(),
      });

      return { success: true };
    } catch (err) {
      console.error("[DB] updateConversationDetails hatası:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Tüm bağlantıları kapat (uygulama kapanırken)
   */
  closeAll() {
    for (const [key, { db }] of connectionPool) {
      try {
        db.close();
        console.log(`[DB] Kapatıldı: ${key}`);
      } catch (err) {
        console.error(`[DB] Kapatma hatası (${key}):`, err);
      }
    }
    connectionPool.clear();
  },

  /**
   * Veritabanını optimize et
   * @param {string} accountId
   */
  optimize(accountId) {
    try {
      const conn = DatabaseManager.getConnection(accountId);
      if (conn) {
        conn.db.exec("VACUUM");
        conn.db.exec("ANALYZE");
        console.log(`[DB] Optimize edildi: ${accountId}`);
      }
    } catch (err) {
      console.error("[DB] Optimize hatası:", err);
    }
  },
};

export default DatabaseManager;
