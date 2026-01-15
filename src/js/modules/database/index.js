/**
 * Database Service - Renderer Process Facade
 *
 * IPC üzerinden main process database'ine erişim sağlar.
 * Tüm DB işlemleri bu modül üzerinden yapılmalıdır.
 *
 * @module src/js/modules/database
 */

import { ConversationStore } from "./conversation-store.js";
import { MessageStore } from "./message-store.js";
import { LogManager } from "../log-manager.js";

// ============================================================================
// Database Service
// ============================================================================

export const DatabaseService = {
  /**
   * Hesap için veritabanını başlat
   * @param {string} accountId - Account ID (örn: chatgpt_user_at_gmail_com)
   * @returns {Promise<{ success: boolean, created?: boolean, error?: string }>}
   */
  async initAccount(accountId) {
    try {
      const result = await window.electronAPI?.dbInitAccount?.({ accountId });
      return result || { success: false, error: "API not available" };
    } catch (err) {
      LogManager.addEvent("database", "error", `initAccount error: ${err.message}`, { context: { accountId } });
      return { success: false, error: err.message };
    }
  },

  /**
   * Konuşmaları getir
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>}
   */
  async getConversations(accountId) {
    return ConversationStore.list(accountId);
  },

  /**
   * Konuşma mesajlarını getir
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<Array>}
   */
  async getMessages(accountId, conversationId) {
    return MessageStore.list(accountId, conversationId);
  },

  /**
   * Mesajları senkronize et (incremental)
   * @param {Object} params - { accountId, webUrl, messages, authors }
   * @returns {Promise<Object>}
   */
  async syncMessages(params) {
    return MessageStore.sync(params);
  },

  /**
   * Mesajlarda arama yap
   * @param {string} accountId - Account ID
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async searchMessages(accountId, query, limit = 50) {
    return MessageStore.search(accountId, query, limit);
  },

  /**
   * Konuşmayı sil
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteConversation(accountId, conversationId) {
    return ConversationStore.delete(accountId, conversationId);
  },

  /**
   * Konuşma detaylarını güncelle
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @param {Object} data - { title?, summary? }
   * @returns {Promise<{ success: boolean }>}
   */
  async updateConversation(accountId, conversationId, data) {
    return ConversationStore.update(accountId, conversationId, data);
  },

  /**
   * Attachment kaydet
   * @param {Object} params - { accountId, conversationId, messageId, ... }
   * @returns {Promise<Object>}
   */
  async saveAttachment(params) {
    try {
      const result = await window.electronAPI?.dbSaveAttachment?.(params);
      return result || { success: false, error: "API not available" };
    } catch (err) {
      LogManager.addEvent("database", "error", `saveAttachment error: ${err.message}`, { context: { params } });
      return { success: false, error: err.message };
    }
  },

  /**
   * Attachment'ları getir
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<Array>}
   */
  async getAttachments(accountId, conversationId) {
    try {
      const result = await window.electronAPI?.dbGetAttachments?.({
        accountId,
        conversationId,
      });
      return result || [];
    } catch (err) {
      LogManager.addEvent("database", "error", `getAttachments error: ${err.message}`, { context: { accountId, conversationId } });
      return [];
    }
  },
};

// Re-export stores
export { ConversationStore } from "./conversation-store.js";
export { MessageStore } from "./message-store.js";

export default DatabaseService;
