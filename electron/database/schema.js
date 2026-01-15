/**
 * Database Schema - Tablo şemaları ve migration
 * 
 * Her hesap için ayrı SQLite dosyası:
 * data/{accountId}/database.db
 * 
 * Tablolar:
 * - conversations: Konuşma metadata'sı
 * - messages: Mesajlar
 * - attachments: Ek dosya referansları
 * - messages_fts: Full-text search (FTS5)
 */

// Schema versiyonu - migration için
const SCHEMA_VERSION = 1;

/**
 * Tablo oluşturma SQL'leri
 */
const CREATE_TABLES_SQL = `
-- Conversations tablosu
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  web_url TEXT NOT NULL,
  title TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  message_count INTEGER DEFAULT 0,
  last_message_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_web_url ON conversations(web_url);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- Messages tablosu
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  author TEXT,
  content TEXT NOT NULL,
  dom_index INTEGER,
  dom_id TEXT,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_hash ON messages(content_hash);
CREATE INDEX IF NOT EXISTS idx_messages_dom_id ON messages(dom_id);

-- Attachments tablosu
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_conversation ON attachments(conversation_id);

-- Schema version tablosu
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

/**
 * FTS5 Full-Text Search tablosu
 */
const CREATE_FTS_SQL = `
-- FTS5 virtual table for message search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  author,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content, author) VALUES (NEW.rowid, NEW.content, NEW.author);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content, author) VALUES('delete', OLD.rowid, OLD.content, OLD.author);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content, author) VALUES('delete', OLD.rowid, OLD.content, OLD.author);
  INSERT INTO messages_fts(rowid, content, author) VALUES (NEW.rowid, NEW.content, NEW.author);
END;
`;

/**
 * Schema'yı veritabanına uygula
 * @param {import('better-sqlite3').Database} db - Database instance
 */
export function applySchema(db) {
  // Ana tabloları oluştur
  db.exec(CREATE_TABLES_SQL);
  
  // FTS5 tablosunu oluştur
  try {
    db.exec(CREATE_FTS_SQL);
  } catch (err) {
    // FTS5 desteklenmiyorsa devam et (bazı sistemlerde olmayabilir)
    console.warn("[DB] FTS5 oluşturulamadı (desteklenmiyor olabilir):", err.message);
  }
  
  // Schema version kaydet
  const versionExists = db.prepare(
    "SELECT version FROM schema_version WHERE version = ?"
  ).get(SCHEMA_VERSION);
  
  if (!versionExists) {
    db.prepare(
      "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)"
    ).run(SCHEMA_VERSION, Date.now());
  }
}

