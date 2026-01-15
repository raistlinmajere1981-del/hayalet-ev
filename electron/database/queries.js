/**
 * Database Queries - Prepared statement'lar
 * 
 * Tüm veritabanı sorguları bu modülde tanımlıdır.
 * createQueries() fonksiyonu prepared statement'ları döndürür.
 * Ayrıca yardımcı fonksiyonlar da export edilir.
 */

import { hashString, generateMessageId, generateConversationId, generateAttachmentId } from "./hash-utils.js";

// ============================================
// Prepared Statements Factory
// ============================================

/**
 * Prepared statement'ları oluştur
 * @param {import('better-sqlite3').Database} db
 * @returns {Object} - Prepared statement koleksiyonu
 */
export function createQueries(db) {
  return {
    // Conversation queries
    getConversations: db.prepare(`
      SELECT id, web_url, title, summary, message_count, last_message_id, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
    `),
    
    getConversationById: db.prepare(`
      SELECT id, web_url, title, summary, message_count, last_message_id, created_at, updated_at
      FROM conversations
      WHERE id = ?
    `),
    
    getConversationByUrl: db.prepare(`
      SELECT id, web_url, title, summary, message_count, last_message_id, created_at, updated_at
      FROM conversations
      WHERE web_url = ?
    `),
    
    getConversationCount: db.prepare(`
      SELECT COUNT(*) as count FROM conversations
    `),
    
    insertConversation: db.prepare(`
      INSERT INTO conversations (id, web_url, title, summary, message_count, last_message_id, created_at, updated_at)
      VALUES (@id, @web_url, @title, @summary, @message_count, @last_message_id, @created_at, @updated_at)
    `),
    
    updateConversation: db.prepare(`
      UPDATE conversations
      SET title = @title, summary = @summary, message_count = @message_count, 
          last_message_id = @last_message_id, updated_at = @updated_at
      WHERE id = @id
    `),
    
    deleteConversation: db.prepare(`
      DELETE FROM conversations WHERE id = ?
    `),
    
    // Message queries
    getMessages: db.prepare(`
      SELECT id, conversation_id, role, author, content, dom_index, dom_id, content_hash, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY dom_index ASC, created_at ASC
    `),
    
    getMessageHashes: db.prepare(`
      SELECT content_hash FROM messages WHERE conversation_id = ?
    `),
    
    getMessageCount: db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
    `),
    
    getLastMessage: db.prepare(`
      SELECT id, content_hash FROM messages
      WHERE conversation_id = ?
      ORDER BY dom_index DESC, created_at DESC
      LIMIT 1
    `),
    
    insertMessage: db.prepare(`
      INSERT INTO messages (id, conversation_id, role, author, content, dom_index, dom_id, content_hash, created_at)
      VALUES (@id, @conversation_id, @role, @author, @content, @dom_index, @dom_id, @content_hash, @created_at)
    `),
    
    // Attachment queries
    getAttachmentsByConversation: db.prepare(`
      SELECT id, message_id, conversation_id, original_name, stored_name, stored_path, mime_type, size, created_at
      FROM attachments
      WHERE conversation_id = ?
    `),
    
    getAttachmentsByMessage: db.prepare(`
      SELECT id, message_id, conversation_id, original_name, stored_name, stored_path, mime_type, size, created_at
      FROM attachments
      WHERE message_id = ?
    `),
    
    insertAttachment: db.prepare(`
      INSERT INTO attachments (id, message_id, conversation_id, original_name, stored_name, stored_path, mime_type, size, created_at)
      VALUES (@id, @message_id, @conversation_id, @original_name, @stored_name, @stored_path, @mime_type, @size, @created_at)
    `),
    
    // Search queries (FTS5)
    searchMessages: db.prepare(`
      SELECT m.id, m.conversation_id, m.role, m.author, m.content, m.created_at,
             c.title as conversation_title, c.web_url,
             snippet(messages_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
      FROM messages_fts
      JOIN messages m ON messages_fts.rowid = m.rowid
      JOIN conversations c ON m.conversation_id = c.id
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `),
  };
}

// ============================================
// Conversation Queries
// ============================================

/**
 * Tüm konuşmaları getir
 * @param {import('better-sqlite3').Database} db
 * @returns {Array}
 */
export function getAllConversations(db) {
  return db.prepare(`
    SELECT id, web_url, title, summary, message_count, last_message_id, created_at, updated_at
    FROM conversations
    ORDER BY updated_at DESC
  `).all();
}

/**
 * Tek bir konuşmayı getir
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @returns {Object|undefined}
 */
export function getConversation(db, conversationId) {
  return db.prepare(`
    SELECT id, web_url, title, summary, message_count, last_message_id, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `).get(conversationId);
}

/**
 * Web URL'e göre konuşma bul
 * @param {import('better-sqlite3').Database} db
 * @param {string} webUrl
 * @returns {Object|undefined}
 */
export function getConversationByUrl(db, webUrl) {
  return db.prepare(`
    SELECT id, web_url, title, summary, message_count, last_message_id, created_at, updated_at
    FROM conversations
    WHERE web_url = ?
  `).get(webUrl);
}

/**
 * Yeni konuşma oluştur
 * @param {import('better-sqlite3').Database} db
 * @param {Object} data - { webUrl, title?, summary? }
 * @returns {Object} - Oluşturulan konuşma
 */
export function createConversation(db, data) {
  const { webUrl, title = "", summary = "" } = data;
  const now = Date.now();
  
  // Sequence numarasını bul
  const maxSeq = db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) as max_seq
    FROM conversations
    WHERE id LIKE 'conv-%'
  `).get();
  
  const sequence = (maxSeq?.max_seq || 0) + 1;
  const id = generateConversationId(sequence);
  
  db.prepare(`
    INSERT INTO conversations (id, web_url, title, summary, message_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, webUrl, title, summary, now, now);
  
  return { id, webUrl, title, summary, messageCount: 0, createdAt: now, updatedAt: now };
}

/**
 * Konuşmayı güncelle
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @param {Object} data - { title?, summary?, webUrl?, messageCount?, lastMessageId? }
 * @returns {boolean}
 */
export function updateConversation(db, conversationId, data) {
  const fields = [];
  const values = [];
  
  if (data.title !== undefined) {
    fields.push("title = ?");
    values.push(data.title);
  }
  if (data.summary !== undefined) {
    fields.push("summary = ?");
    values.push(data.summary);
  }
  if (data.webUrl !== undefined) {
    fields.push("web_url = ?");
    values.push(data.webUrl);
  }
  if (data.messageCount !== undefined) {
    fields.push("message_count = ?");
    values.push(data.messageCount);
  }
  if (data.lastMessageId !== undefined) {
    fields.push("last_message_id = ?");
    values.push(data.lastMessageId);
  }
  
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(conversationId);
  
  const result = db.prepare(`
    UPDATE conversations SET ${fields.join(", ")} WHERE id = ?
  `).run(...values);
  
  return result.changes > 0;
}

/**
 * Konuşmayı sil
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @returns {boolean}
 */
export function deleteConversation(db, conversationId) {
  // CASCADE ile messages ve attachments da silinir
  const result = db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
  return result.changes > 0;
}

// ============================================
// Message Queries
// ============================================

/**
 * Konuşmanın mesajlarını getir
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @returns {Array}
 */
export function getMessages(db, conversationId) {
  return db.prepare(`
    SELECT id, conversation_id, role, author, content, dom_index, dom_id, content_hash, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY dom_index ASC, created_at ASC
  `).all(conversationId);
}

/**
 * Konuşmadaki mevcut hash'leri getir (incremental sync için)
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @returns {Set<string>}
 */
export function getExistingHashes(db, conversationId) {
  const rows = db.prepare(`
    SELECT content_hash FROM messages WHERE conversation_id = ?
  `).all(conversationId);
  
  return new Set(rows.map(r => r.content_hash));
}

/**
 * Mesaj ekle
 * @param {import('better-sqlite3').Database} db
 * @param {Object} data
 * @returns {Object}
 */
export function insertMessage(db, data) {
  const {
    conversationId,
    role,
    author,
    content,
    domIndex,
    domId = null,
    contentHash = null,
  } = data;
  
  const id = generateMessageId();
  const now = Date.now();
  const hash = contentHash || hashString(content);
  
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, author, content, dom_index, dom_id, content_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, conversationId, role, author, content, domIndex, domId, hash, now);
  
  return { id, conversationId, role, author, content, domIndex, domId, contentHash: hash, createdAt: now };
}

/**
 * Batch mesaj ekleme (transaction içinde)
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @param {Array} messages
 * @returns {Array} - Eklenen mesajlar
 */
export function insertMessagesBatch(db, conversationId, messages) {
  const insertStmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, author, content, dom_index, dom_id, content_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const now = Date.now();
  const inserted = [];
  
  const insertMany = db.transaction((msgs) => {
    for (const msg of msgs) {
      const id = generateMessageId();
      const hash = msg.contentHash || hashString(msg.content || msg.text);
      
      insertStmt.run(
        id,
        conversationId,
        msg.role,
        msg.author || (msg.role === "assistant" ? "AI" : "User"),
        msg.content || msg.text || "",
        msg.domIndex ?? msg.index ?? 0,
        msg.domId || null,
        hash,
        msg.ts || now
      );
      
      inserted.push({ id, contentHash: hash });
    }
  });
  
  insertMany(messages);
  return inserted;
}

// ============================================
// Attachment Queries
// ============================================

/**
 * Mesajın attachment'larını getir
 * @param {import('better-sqlite3').Database} db
 * @param {string} messageId
 * @returns {Array}
 */
export function getAttachmentsByMessage(db, messageId) {
  return db.prepare(`
    SELECT id, message_id, conversation_id, original_name, stored_name, stored_path, mime_type, size, created_at
    FROM attachments
    WHERE message_id = ?
  `).all(messageId);
}

/**
 * Konuşmanın tüm attachment'larını getir
 * @param {import('better-sqlite3').Database} db
 * @param {string} conversationId
 * @returns {Array}
 */
export function getAttachmentsByConversation(db, conversationId) {
  return db.prepare(`
    SELECT id, message_id, conversation_id, original_name, stored_name, stored_path, mime_type, size, created_at
    FROM attachments
    WHERE conversation_id = ?
  `).all(conversationId);
}

/**
 * Attachment ekle
 * @param {import('better-sqlite3').Database} db
 * @param {Object} data
 * @returns {Object}
 */
export function insertAttachment(db, data) {
  const {
    messageId,
    conversationId,
    originalName,
    storedName,
    storedPath,
    mimeType = null,
    size = null,
  } = data;
  
  const id = generateAttachmentId();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO attachments (id, message_id, conversation_id, original_name, stored_name, stored_path, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, messageId, conversationId, originalName, storedName, storedPath, mimeType, size, now);
  
  return { id, messageId, conversationId, originalName, storedName, storedPath, mimeType, size, createdAt: now };
}

// ============================================
// Search Queries (FTS5)
// ============================================

/**
 * Mesajlarda arama yap (FTS5)
 * @param {import('better-sqlite3').Database} db
 * @param {string} query - Arama sorgusu
 * @param {number} limit - Sonuç limiti
 * @returns {Array}
 */
export function searchMessages(db, query, limit = 50) {
  try {
    return db.prepare(`
      SELECT m.id, m.conversation_id, m.role, m.author, m.content, m.created_at,
             highlight(messages_fts, 0, '<mark>', '</mark>') as highlighted
      FROM messages_fts
      JOIN messages m ON messages_fts.rowid = m.rowid
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);
  } catch (err) {
    // FTS5 desteklenmiyorsa LIKE ile fallback
    console.warn("[DB] FTS5 search failed, using LIKE fallback:", err.message);
    return db.prepare(`
      SELECT id, conversation_id, role, author, content, created_at
      FROM messages
      WHERE content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(`%${query}%`, limit);
  }
}
