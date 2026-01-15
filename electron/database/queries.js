/**
 * Database Queries - Prepared statement'lar
 * 
 * Tüm veritabanı sorguları bu modülde tanımlıdır.
 * createQueries() fonksiyonu prepared statement'ları döndürür.
 * Ayrıca yardımcı fonksiyonlar da export edilir.
 */

// Hash utils - prepared statements için gerekli değil, sadece createQueries export ediliyor

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


