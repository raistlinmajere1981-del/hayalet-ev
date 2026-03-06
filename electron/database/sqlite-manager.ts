/**
 * SQLite Database Manager - Per-Account Database Factory
 *
 * Her hesap için ayrı SQLite veritabanı dosyası oluşturur ve yönetir.
 * Format: data/{email}_{provider}/archive.db
 *
 * @module electron/database/sqlite-manager
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { getLoggerCore } from "../logger/index.js";
import { Paths } from "../paths.ts";
import { LogCategory, LogLevel } from "@shared/index.js";

const logger = getLoggerCore();

type AccountKey = string;

interface DatabaseInstance {
  db: Database.Database;
  accountId: string;
  accountFolder: string;
  lastAccessed: number;
}

const databasePool = new Map<AccountKey, DatabaseInstance>();

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      web_url TEXT NOT NULL,
      provider TEXT,
      title TEXT,
      summary TEXT,
      message_count INTEGER DEFAULT 0,
      last_message_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conv_account ON conversations(account_id);
    CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      role TEXT,
      author TEXT,
      content TEXT,
      dom_index INTEGER,
      dom_id TEXT,
      content_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_msg_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_msg_account ON messages(account_id);
    CREATE INDEX IF NOT EXISTS idx_msg_content ON messages(content);
    CREATE INDEX IF NOT EXISTS idx_msg_dom ON messages(conversation_id, dom_index);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      original_name TEXT,
      stored_name TEXT,
      stored_path TEXT,
      mime_type TEXT,
      size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attach_message ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_attach_conversation ON attachments(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_attach_account ON attachments(account_id);
  `);

  db.exec("PRAGMA foreign_keys = ON");
}

export function getDatabaseForAccount(accountId: string): Database.Database {
  const existing = databasePool.get(accountId);
  if (existing !== undefined) {
    existing.lastAccessed = Date.now();
    return existing.db;
  }

  const accountPath = Paths.getAccountDir(accountId);
  const dbPath = Paths.getAccountDbPath(accountId);

  mkdirSync(accountPath, { recursive: true });

  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL");

  initializeSchema(db);

  databasePool.set(accountId, {
    db,
    accountId,
    accountFolder: accountPath,
    lastAccessed: Date.now(),
  });

  return db;
}

export function getAccountFolder(accountId: string): string {
  return Paths.getAccountDir(accountId);
}

export function closeDatabaseForAccount(accountId: string): void {
  const instance = databasePool.get(accountId);
  if (instance !== undefined) {
    try {
      instance.db.close();
    } catch (err) {
      void logger.logInternal(
        LogCategory.DATABASE,
        LogLevel.ERROR,
        `Failed to close database for ${accountId}`,
        { error: err }
      );
    }
    databasePool.delete(accountId);
  }
}

export function closeAllDatabases(): void {
  for (const [accountId, instance] of databasePool) {
    try {
      instance.db.close();
    } catch (err) {
      void logger.logInternal(
        LogCategory.DATABASE,
        LogLevel.ERROR,
        `Failed to close database for ${accountId}`,
        { error: err }
      );
    }
  }
  databasePool.clear();
}

export function getAttachmentPath(
  accountId: string,
  conversationId: string,
  messageId: string,
  filename: string
): string {
  const accountPath = getAccountFolder(accountId);
  return join(accountPath, conversationId, messageId, filename);
}

export function ensureAttachmentDir(
  accountId: string,
  conversationId: string,
  messageId: string
): string {
  const accountPath = getAccountFolder(accountId);
  const dir = join(accountPath, conversationId, messageId);
  mkdirSync(dir, { recursive: true });
  return dir;
}
