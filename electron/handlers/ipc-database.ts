/**
 * IPC Database Handlers
 * 
 * Database işlemleri için IPC handler'ları.
 * Main.ts'den ayrıştırılarak modüler hale getirildi.
 */

import { registerHandler } from "./ipc-helpers.ts";
import { DatabaseManager } from "../database/index.ts";
import type { SyncMessagesParams } from "../types/index.ts";

/**
 * Database IPC handler'larını kur
 */
export function setupDatabaseHandlers(): void {
  // Account initialization
  registerHandler("db-init-account", (event, params: { accountId: string }) =>
    DatabaseManager.initAccount(event, params)
  );

  // Conversations
  registerHandler("db-get-conversations", (event, params: { accountId: string }) =>
    DatabaseManager.getConversations(event, params)
  );

  registerHandler("db-delete-conversation", (event, params: { accountId: string; conversationId: string }) =>
    DatabaseManager.deleteConversation(event, params)
  );

  registerHandler("db-update-conversation", (event, params: { accountId: string; conversationId: string; title?: string; summary?: string }) =>
    DatabaseManager.updateConversationDetails(event, params)
  );

  // Messages
  registerHandler("db-get-messages", (event, params: { accountId: string; conversationId: string }) =>
    DatabaseManager.getMessages(event, params)
  );

  registerHandler("db-sync-messages", (event, params: SyncMessagesParams) =>
    DatabaseManager.syncMessages(event, params)
  );

  // Attachments
  registerHandler("db-save-attachment", (event, params: { 
    accountId: string; 
    conversationId: string; 
    messageId: string; 
    filePath: string; 
    originalName: string; 
    mimeType?: string 
  }) =>
    DatabaseManager.saveAttachment(event, params)
  );

  registerHandler("db-get-attachments", (event, params: { accountId: string; conversationId: string }) =>
    DatabaseManager.getAttachments(event, params)
  );

  // Search
  registerHandler("db-search-messages", (event, params: { accountId: string; query: string; limit?: number }) =>
    DatabaseManager.searchMessages(event, params)
  );

  registerHandler("db-search-attachments", (event, params: { accountId: string; query: string; limit?: number }) =>
    DatabaseManager.searchAttachments(event, params)
  );

  registerHandler("db-search-all-accounts", (event, params: { query: string; limit?: number }) =>
    DatabaseManager.searchAllAccounts(event, params)
  );
}
